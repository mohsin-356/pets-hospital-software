import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiPlus, FiMinus, FiTrash2, FiPrinter, FiShoppingCart, FiX, FiGrid, FiList, FiEyeOff, FiMaximize2, FiEdit3, FiSave } from 'react-icons/fi';
import { pharmacyMedicinesAPI, pharmacySalesAPI, settingsAPI, pharmacyDuesAPI, petsAPI, prescriptionsAPI } from '../../services/api';

export default function PharmacyPOS() {
  const [medicines, setMedicines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    customerName: '',
    customerContact: '',
    petName: '',
    patientId: '',
    clientId: '',
    species: '',
    breed: '',
    sex: '',
    age: '',
    weight: '',
    address: '',
    followUpDate: '',
    comments: ''
  });
  const [discount, setDiscount] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [availableMethods, setAvailableMethods] = useState(['Cash','Bank Account','Credit','Easypaisa','JazzCash','Other']);
  const [newMethodName, setNewMethodName] = useState('');
  const [paymentCharge, setPaymentCharge] = useState(0); // editable surcharge
  const [isChargeManual, setIsChargeManual] = useState(false); // track manual override
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [previousDue, setPreviousDue] = useState(0);
  const [toast, setToast] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [hideInventory, setHideInventory] = useState(false);
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const receiptRef = useRef();

  useEffect(() => {
    fetchMedicines();
    fetchHospitalSettings();
    loadPrescriptionData();
    // Load saved payment methods
    try {
      const saved = JSON.parse(localStorage.getItem('pharmacy_payment_methods')||'[]')
      if (Array.isArray(saved) && saved.length) setAvailableMethods(prev=>[...new Set([...saved, ...prev])])
    } catch{}
  }, []);

  // Persist selected payment method
  useEffect(()=>{
    try { if (paymentMethod) localStorage.setItem('paymentMethod', paymentMethod) } catch{}
  },[paymentMethod])

  useEffect(() => {
    // Auto-add medicines to cart when medicines are loaded and prescription data exists
    const posData = localStorage.getItem('pharmacy_pos_data');
    if (posData && medicines.length > 0) {
      const data = JSON.parse(posData);
      // Only process if timestamp is recent (within last 5 minutes)
      if (Date.now() - data.timestamp < 300000) {
        autoAddPrescriptionMedicines(data);
      }
    }
  }, [medicines]);

  // Debounced auto-add on exact barcode match (works even if scanner doesn't send Enter)
  useEffect(() => {
    const q = (searchQuery || '').trim();
    if (!q) return;
    const timer = setTimeout(() => {
      const exact = medicines.find(m => (m.barcode || '').toLowerCase() === q.toLowerCase());
      if (exact) {
        addToCart(exact);
        setSearchQuery('');
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, medicines]);

  // When a patient enters Patient ID, fetch latest prescription and propose auto-add
  useEffect(() => {
    const id = (customerInfo.patientId || '').trim();
    if (!id) return;
    // If we already have a structured prescription payload from Prescriptions -> Send to POS,
    // do not auto-add again using the fallback getByPatient API, otherwise it can override
    // calculated doses/quantities coming from that flow.
    try {
      const existingPosData = localStorage.getItem('pharmacy_pos_data');
      if (existingPosData) return;
    } catch {}
    (async () => {
      try {
        const res = await prescriptionsAPI.getByPatient(id);
        const list = Array.isArray(res?.data) ? res.data : [];
        if (!list.length) return;
        // Latest by date
        const latest = list.slice().sort((a,b) => new Date(b.when) - new Date(a.when))[0];
        const items = (latest.items || []).map(it => ({
          medicineName: it.name,
          quantity: 1,
          dosage: it.doseRate || it.dose || it.instructions || ''
        }));
        if (items.length === 0) return;
        // Use existing helper to add
        autoAddPrescriptionMedicines({ cartItems: items });
      } catch (e) {
        // Silent fail to avoid interrupting POS flow
      }
    })();
  }, [customerInfo.patientId]);

  const fetchMedicines = async () => {
    try {
      const response = await pharmacyMedicinesAPI.getAll();
      setMedicines(response.data || []);
    } catch (error) {
      console.error('Error fetching medicines:', error);
    }
  };

  const fetchHospitalSettings = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await settingsAPI.get(user.username || 'admin');
      setHospitalSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const generatePatientId = () => {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${year}${month}${day}${random}`;
  };

  const generateClientId = () => {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `${timestamp}${random}`;
  };

  const loadPrescriptionData = () => {
    const posData = localStorage.getItem('pharmacy_pos_data');
    if (posData) {
      try {
        const data = JSON.parse(posData);
        // Only load if timestamp is recent (within last 5 minutes)
        if (Date.now() - data.timestamp < 300000) {
          setCustomerInfo({
            customerName: data.customerName || '',
            customerContact: data.customerContact || '',
            petName: data.petName || '',
            species: data.species || '',
            breed: data.breed || '',
            sex: data.sex || '',
            age: data.age || '',
            weight: data.weight || '',
            address: data.address || '',
            patientId: data.patientId || '',
            clientId: data.clientId || generateClientId(),
            followUpDate: '',
            comments: ''
          });
          showToast(`Prescription loaded for ${data.petName || 'patient'} - All patient data auto-filled`);
        }
      } catch (error) {
        console.error('Error loading prescription data:', error);
      }
    }
  };

  // When opening payment modal, ensure clientId exists
  // Utilities for simple dues persistence (fallback if backend unavailable)
  const getStoredDues = () => {
    try { return JSON.parse(localStorage.getItem('pharmacy_dues')||'{}') } catch { return {}; }
  };
  const setStoredDues = (map) => {
    try { localStorage.setItem('pharmacy_dues', JSON.stringify(map)); } catch {}
  };

  useEffect(()=>{
    if (showPaymentModal) {
      setCustomerInfo(ci=>{
        const next = {
          ...ci,
          clientId: ci.clientId || generateClientId(),
          patientId: ci.patientId || generatePatientId()
        };
        // Load previous dues for this client (backend first, then fallback local)
        (async ()=>{
          try {
            const res = await pharmacyDuesAPI.getByClient(next.clientId);
            setPreviousDue(Number(res.previousDue||0));
          } catch (e) {
            const duesMap = getStoredDues();
            const prev = Number(duesMap[next.clientId]||0);
            setPreviousDue(prev);
          }
        })();
        // Do not overwrite user's typed amount if already set; only default when zero
        const computedSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
        const base = Math.max(0, computedSubtotal - Number(discount||0));
        const totalLocal = Math.max(0, base + Number(paymentCharge||0));
        setReceivedAmount(v => (v && v > 0 ? v : totalLocal));
        setReceivedTouched(false);
        return next;
      });
    }
  },[showPaymentModal])

  // Auto-calc 2% payment charge for non-cash methods unless manually overridden
  useEffect(()=>{
    if (isChargeManual) return;
    const method = (paymentMethod || '').toLowerCase();
    const nonCash = method && method !== 'cash';
    const computedSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const base = Math.max(0, computedSubtotal - Number(discount||0));
    const auto = nonCash ? Number((base * 0.02).toFixed(2)) : 0;
    setPaymentCharge(auto);
  }, [paymentMethod, cart, discount, isChargeManual]);

  // Keep Received equal to Total automatically unless user edits it
  useEffect(()=>{
    if (!showPaymentModal) return;
    if (receivedTouched) return;
    const computedSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const base = Math.max(0, computedSubtotal - Number(discount||0));
    const totalLocal = Math.max(0, base + Number(paymentCharge||0));
    setReceivedAmount(totalLocal);
  }, [paymentMethod, paymentCharge, cart, discount, showPaymentModal, receivedTouched]);

  // When Patient ID changes, auto-resolve client/person details and dues
  useEffect(()=>{
    const id = (customerInfo.patientId||'').trim();
    if (!id) return;
    (async ()=>{
      try {
        const res = await petsAPI.search(id);
        const list = res.data || [];
        const pet = list.find(p => String(p.id)===String(id) || String(p.patientId)===String(id)) || list[0];
        if (pet) {
          setCustomerInfo(prev => ({
            ...prev,
            patientId: prev.patientId || pet.id || pet.patientId || id,
            clientId: prev.clientId || pet.clientId || pet.details?.owner?.clientId || prev.clientId,
            customerName: prev.customerName || pet.ownerName || pet.details?.owner?.fullName || prev.customerName,
            customerContact: prev.customerContact || pet.ownerContact || pet.details?.owner?.contact || prev.customerContact,
            petName: prev.petName || pet.petName || prev.petName
          }));
        }
      } catch {}
    })();
  },[customerInfo.patientId])

  // Also refresh dues whenever clientId changes so Bill Summary shows correct receivable
  useEffect(()=>{
    const id = customerInfo.clientId;
    if (!id) return;
    (async ()=>{
      try {
        const res = await pharmacyDuesAPI.getByClient(id);
        setPreviousDue(Number(res.previousDue||0));
      } catch (e) {
        // fallback to local store
        const duesMap = getStoredDues();
        setPreviousDue(Number(duesMap[id]||0));
      }
    })();
  },[customerInfo.clientId])

  const normalizeMedicineName = (value = '') => {
    // Keep only letters to ignore strength, units, punctuation, etc.
    // e.g. "Hydrozole 1.32 g" and "Hydrozole Cream" -> "hydrozoleg" / "hydrozolecream"
    return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  };

  const autoAddPrescriptionMedicines = async (data) => {
    if (!data.cartItems || data.cartItems.length === 0) return;
    let addedCount = 0;
    const notFound = [];
    const outOfStock = [];
    const newCart = [...cart];

    const pushOrAccumulatePlaceholder = (name, qty, dosage, unitHint = 'unit', note = '') => {
      const idx = newCart.findIndex(c => !c.medicineId && (c.medicineName||'').toLowerCase() === String(name||'').toLowerCase());
      if (idx >= 0) {
        newCart[idx].quantity = Number(newCart[idx].quantity||0) + Number(qty||0);
        newCart[idx].dosage = newCart[idx].dosage || dosage;
        newCart[idx].unit = unitHint;
      } else {
        newCart.push({
          medicineId: null,
          medicineName: name,
          batchNo: '',
          category: 'Unknown',
          quantity: Number(qty||0) || 1,
          unit: unitHint,
          pricePerUnit: 0,
          availableStock: 0,
          expiryDate: '',
          dosage: dosage,
          totalPrice: 0,
          isEditable: true,
          isPlaceholder: true,
          note
        });
      }
    };

    const canon = (s='') => String(s||'').toLowerCase().replace(/\s+/g,' ').trim();

    for (const item of data.cartItems) {
      const rawName = item.medicineName || item.searchTerm || '';
      const name = normalizeMedicineName(rawName);
      // 1) Try strict canonical equality/includes first (keeps digits)
      let medicine = medicines.find(m => {
        const a = canon(m.medicineName);
        const b = canon(rawName);
        if (!a || !b) return false;
        return a === b || a.includes(b) || b.includes(a);
      });
      // 2) Fallback to letters-only normalization
      if (!medicine) medicine = medicines.find(m => {
        const inv = normalizeMedicineName(m.medicineName);
        if (!inv || !name) return false;
        return inv === name || inv.includes(name) || name.includes(inv);
      });

      // Fallback: match on first word (brand name) if full string didn't match
      if (!medicine) {
        const firstToken = normalizeMedicineName(String(rawName).split(/[^A-Za-z0-9]+/)[0] || '');
        if (firstToken) {
          medicine = medicines.find(m => {
            const inv = normalizeMedicineName(m.medicineName);
            if (!inv) return false;
            return inv.includes(firstToken) || firstToken.includes(inv);
          });
        }
      }

      // 3) Last resort: server-side search
      if (!medicine) {
        try {
          const res = await pharmacyMedicinesAPI.search(rawName);
          const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          medicine = (list || []).find(m => {
            const a = canon(m.medicineName || m.name);
            const b = canon(rawName);
            if (!a || !b) return false;
            return a === b || a.includes(b) || b.includes(a);
          }) || (list || [])[0];
        } catch {}
      }

      if (!medicine) {
        notFound.push(item.medicineName);
        pushOrAccumulatePlaceholder(item.medicineName, item.quantity, item.dosage, item.unitHint||'unit', 'Not in inventory');
        continue;
      }

      // Remove any existing placeholders for this exact name
      {
        const target = canon(item.medicineName);
        for (let i = newCart.length - 1; i >= 0; i--) {
          const it = newCart[i];
          if (!it.medicineId && canon(it.medicineName) === target) newCart.splice(i,1);
        }
      }

      const isInjection = medicine.category === 'Injection';
      const hasStock = isInjection
        ? (Number(medicine.remainingMl||0) > 0 || Number(medicine.mlPerVial||0) > 0 || Number(medicine.quantity||0) > 0)
        : Number(medicine.quantity||0) > 0;
      if (!hasStock) {
        outOfStock.push(item.medicineName);
        pushOrAccumulatePlaceholder(item.medicineName, item.quantity, item.dosage, item.unitHint||medicine.unit||'unit', 'Out of stock');
        continue;
      }

      const existingIndex = newCart.findIndex(c => c.medicineId === medicine._id);
      const cap = Number(medicine.mlPerVial || 0);
      const doseFromUnitHint = (() => {
        const q = Number(item.quantity||0);
        if (!isInjection) return q; // tablets/capsules -> unit count; syrups with cap>0 handled below
        if ((item.unitHint||'').toLowerCase() === 'container') return q * (cap || 1);
        return q; // ml by default
      })();

      if (existingIndex >= 0) {
        if (isInjection) {
          newCart[existingIndex].mlUsed = Number(newCart[existingIndex].mlUsed||0) + Number(doseFromUnitHint||0);
          const dose = Number(newCart[existingIndex].mlUsed || 0);
          // Bill injections per ml with rounding: 0.1-0.9 => 1ml, 1.1-1.9 => 2ml, etc.
          const units = Math.max(1, Math.ceil(dose));
          newCart[existingIndex].totalPrice = units * Number(medicine.salePrice || 0);
        } else {
          if (cap > 0) {
            const prevDose = Number(newCart[existingIndex].doseRequested || 0);
            const newDose = prevDose + Number(doseFromUnitHint || 0);
            newCart[existingIndex].doseRequested = newDose;
            const nextUnits = Math.max(1, Math.ceil(newDose / cap));
            const stock = Number(newCart[existingIndex].availableStock || 0);
            if (nextUnits > stock) {
              showToast('Insufficient stock');
              return;
            }
            newCart[existingIndex].quantity = nextUnits;
            newCart[existingIndex].totalPrice = newCart[existingIndex].quantity * newCart[existingIndex].pricePerUnit;
          } else {
            newCart[existingIndex].quantity = Number(newCart[existingIndex].quantity||0) + Number(doseFromUnitHint||0);
            newCart[existingIndex].totalPrice = newCart[existingIndex].quantity * newCart[existingIndex].pricePerUnit;
          }
        }
      } else {
        const newItem = {
          medicineId: medicine._id,
          medicineName: medicine.medicineName,
          batchNo: medicine.batchNo,
          category: medicine.category,
          containerType: medicine.containerType,
          unit: medicine.unit,
          pricePerUnit: medicine.salePrice,
          availableStock: medicine.quantity,
          expiryDate: medicine.expiryDate,
          dosage: item.dosage || medicine.dosage
        };

        if (isInjection) {
          const capInj = Math.max(1, Number(medicine.mlPerVial || 1));
          const rawMl = Number(doseFromUnitHint||0);
          // Ensure at least 1ml is billed even if prescription dose is missing/zero
          const usedMl = rawMl > 0 ? rawMl : 1;
          const units = Math.max(1, Math.ceil(usedMl));
          Object.assign(newItem, {
            quantity: 1,
            mlUsed: usedMl,
            mlPerVial: capInj,
            remainingMl: (Number(medicine.remainingMl||0) > 0 ? Number(medicine.remainingMl) : capInj),
            totalPrice: units * Number(medicine.salePrice || 0),
            isEditable: true
          });
        } else {
          if (cap > 0) {
            const dose = Number(doseFromUnitHint||0);
            const units = Math.max(1, Math.ceil(dose / cap));
            Object.assign(newItem, { mlPerVial: cap, doseRequested: dose, quantity: units, totalPrice: units * Number(medicine.salePrice || 0) });
          } else {
            Object.assign(newItem, { quantity: Number(doseFromUnitHint||0) || 1, totalPrice: (Number(doseFromUnitHint||0) || 1) * Number(medicine.salePrice || 0) });
          }
        }
        newCart.push(newItem);
      }
      addedCount++;
    }

    setCart(newCart);
    const parts = [];
    if (addedCount > 0) parts.push(`${addedCount} medicine(s) added from prescription`);
    if (notFound.length) parts.push(`Not in inventory: ${notFound.slice(0,3).join(', ')}${notFound.length>3?'…':''}`);
    if (outOfStock.length) parts.push(`Out of stock: ${outOfStock.slice(0,3).join(', ')}${outOfStock.length>3?'…':''}`);
    showToast(parts.join(' | '));
    localStorage.removeItem('pharmacy_pos_data');
  };

  const searchMedicines = medicines.filter(m =>
    m.medicineName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  const addToCart = (medicine) => {
    const existing = cart.find(item => item.medicineId === medicine._id);
    
    if (existing) {
      if (medicine.category === 'Injection') {
        // Increase ML used; charge per ml, round up to nearest whole ml, min 1
        const currentMlUsed = existing.mlUsed || 1;
        const availableMl = existing.remainingMl || medicine.remainingMl || medicine.mlPerVial || 0;
        if (currentMlUsed >= availableMl) { showToast('No more ML available in this batch'); return; }
        const newMlUsed = currentMlUsed + 1;
        const billUnits = Math.max(1, Math.ceil(newMlUsed));
        const newTotalPrice = billUnits * Number(medicine.salePrice || 0);
        setCart(cart.map(item => item.medicineId === medicine._id ? { ...item, mlUsed: newMlUsed, totalPrice: newTotalPrice } : item));
        showToast(`${medicine.medicineName} ML updated`);
      } else {
        // Regular items
        if (existing.quantity >= medicine.quantity) { showToast('Insufficient stock'); return; }
        setCart(cart.map(item => {
          if (item.medicineId !== medicine._id) return item;
          const cap = Number(medicine.mlPerVial || 0);
          if (cap > 0 && Number(item.doseRequested || 0) > 0) {
            const newDose = Number(item.doseRequested || 0) + 1;
            const units = Math.max(1, Math.ceil(newDose / cap));
            const stock = Number(item.availableStock || 0);
            if (units > stock) { showToast('Insufficient stock'); return item; }
            return { ...item, doseRequested: newDose, quantity: units, totalPrice: units * item.pricePerUnit };
          }
          return { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.pricePerUnit };
        }));
        showToast(`${medicine.medicineName} quantity updated`);
      }
    } else {
      // New item
      if (medicine.category === 'Injection') {
        const availableMl = medicine.remainingMl || medicine.mlPerVial || 0;
        if (availableMl <= 0) { showToast('Injection out of stock'); return; }
      } else {
        if (medicine.quantity === 0) { showToast('Medicine out of stock'); return; }
      }
      const newItem = {
        medicineId: medicine._id,
        medicineName: medicine.medicineName,
        batchNo: medicine.batchNo,
        category: medicine.category,
        containerType: medicine.containerType,
        quantity: medicine.category === 'Injection' ? 1 : 1,
        unit: medicine.unit,
        pricePerUnit: medicine.salePrice,
        availableStock: medicine.quantity,
        expiryDate: medicine.expiryDate,
        dosage: medicine.dosage
      };
      if (medicine.category === 'Injection') {
        newItem.mlUsed = 1;
        newItem.mlPerVial = medicine.mlPerVial || 1;
        newItem.remainingMl = medicine.remainingMl || medicine.mlPerVial || 0;
        const units = Math.max(1, Math.ceil(1));
        newItem.totalPrice = units * Number(medicine.salePrice || 0); // at least one vial
        newItem.isEditable = true;
      } else {
        const cap = Number(medicine.mlPerVial || 0);
        if (cap > 0) {
          const dose = 1;
          const units = Math.max(1, Math.ceil(dose / cap));
          newItem.mlPerVial = cap;
          newItem.doseRequested = dose;
          newItem.quantity = units;
          newItem.totalPrice = units * Number(medicine.salePrice || 0);
        } else {
          newItem.totalPrice = medicine.salePrice;
        }
      }
      setCart([...cart, newItem]);
      showToast(`${medicine.medicineName} added to cart`);
    }
    setSearchQuery('');
  };

  const updateQuantity = (medicineId, newQuantity) => {
    const item = cart.find(i => i.medicineId === medicineId);
    if (!item) return;
    const qty = parseFloat(newQuantity);
    if (isNaN(qty)) return;

    if (item.category === 'Injection') {
      const cap = Math.max(1, Number(item.mlPerVial || 1));
      const totalAvailableMl = Math.max(0, Number(item.remainingMl || 0)) + Math.max(0, Number(item.availableStock || 0)) * cap;
      if (qty > totalAvailableMl) { showToast(`Only ${totalAvailableMl}ml available in stock`); return; }
      if (qty <= 0) { removeFromCart(medicineId); return; }
      const units = Math.max(1, Math.ceil(qty));
      const newTotalPrice = units * Number(item.pricePerUnit || 0);
      setCart(cart.map(cartItem => (
        cartItem.medicineId === medicineId
          ? { ...cartItem, mlUsed: qty, totalPrice: newTotalPrice }
          : cartItem
      )));
    } else {
      if (qty > item.availableStock) { showToast('Insufficient stock'); return; }
      if (qty <= 0) { removeFromCart(medicineId); return; }
      setCart(cart.map(cartItem => (
        cartItem.medicineId === medicineId
          ? { ...cartItem, quantity: qty, doseRequested: 0, totalPrice: qty * cartItem.pricePerUnit }
          : cartItem
      )));
    }
  };

  const updateDose = (medicineId, newDose) => {
    setCart(cart.map(item => {
      if (item.medicineId !== medicineId) return item;
      const cap = Number(item.mlPerVial || 0);
      if (!(cap > 0)) return item;
      const dose = Number(newDose);
      if (!isFinite(dose)) return item;
      if (dose <= 0) {
        showToast('Dose must be greater than 0');
        return item;
      }
      const units = Math.max(1, Math.ceil(dose / cap));
      const stock = Number(item.availableStock || 0);
      if (units > stock) {
        showToast('Insufficient stock');
        const maxUnits = Math.max(0, stock);
        const clampedDose = maxUnits * cap;
        const updated = { ...item, doseRequested: clampedDose, quantity: maxUnits };
        updated.totalPrice = maxUnits * Number(item.pricePerUnit || 0);
        return updated;
      }
      const updated = { ...item, doseRequested: dose, quantity: units };
      updated.totalPrice = units * Number(item.pricePerUnit || 0);
      return updated;
    }));
  };

  const updateMlUsed = (medicineId, newMlUsed) => {
    updateQuantity(medicineId, newMlUsed);
  };

  const updatePrice = (medicineId, newPrice) => {
    const item = cart.find(i => i.medicineId === medicineId);
    if (!item) return;
    
    if (newPrice < 0) {
      showToast('Price cannot be negative');
      return;
    }
    
    setCart(cart.map(cartItem => {
      if (cartItem.medicineId !== medicineId) return cartItem;
      const isInj = cartItem.category === 'Injection';
      let newTotal;
      if (isInj) {
        const units = Math.max(1, Math.ceil(Number(cartItem.mlUsed||0)));
        newTotal = units * Number(newPrice || 0);
      } else if (Number(cartItem.doseRequested||0) > 0 && Number(cartItem.mlPerVial||0) > 0) {
        const units = Math.max(1, Math.ceil(Number(cartItem.doseRequested||0) / Number(cartItem.mlPerVial||1)));
        newTotal = units * Number(newPrice || 0);
      } else {
        newTotal = Number(cartItem.quantity||0) * Number(newPrice || 0);
      }
      return { ...cartItem, pricePerUnit: newPrice, totalPrice: newTotal };
    }));
  };

  // Professional category mapping system
  const getMainCategory = (subCategory) => {
    const medicineCategories = [
      'Injection', 'Tablet', 'Capsule', 'Syrup', 'Powder', 
      'Drops', 'Ointment', 'Cream', 'Gel', 'Spray'
    ];
    
    const surgicalCategories = [
      'Needle', 'Syringe', 'Cannula', 'Catheter', 'Bandage', 
      'Gauze', 'Surgical Instrument', 'Suture', 'Gloves'
    ];
    
    const category = subCategory?.toLowerCase() || '';
    
    if (medicineCategories.some(med => category.includes(med.toLowerCase()))) {
      return 'Medicine';
    } else if (surgicalCategories.some(surg => category.includes(surg.toLowerCase()))) {
      return 'Surgical Supplies';
    } else {
      return 'Other Items';
    }
  };

  const removeFromCart = (medicineId) => {
    setCart(cart.filter(item => item.medicineId !== medicineId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerInfo({ customerName: '', customerContact: '', petName: '' });
    setDiscount(0);
    // Keep receivedAmount/previousDue so user can continue flow if needed
  };

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount = discount; // Treat discount as fixed amount, not percentage
  const totalBeforeCharge = Math.max(0, subtotal - discountAmount);
  const totalAmount = Math.max(0, totalBeforeCharge + Number(paymentCharge||0)); // Include payment charge
  const currentDue = Math.max(0, (Number(totalAmount)||0) - (Number(receivedAmount)||0));
  const combinedDue = Math.max(0, Number(previousDue||0) + Number(currentDue||0));

  const addPaymentMethod = () => {
    const name = (newMethodName || '').trim();
    if (!name) return;
    setAvailableMethods(prev => {
      const next = [...new Set([...prev, name])];
      try { localStorage.setItem('pharmacy_payment_methods', JSON.stringify(next)) } catch{}
      return next;
    });
    setPaymentMethod(name);
    setNewMethodName('');
  };

  const processSale = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty');
      return;
    }

    if (!paymentMethod) {
      showToast('Select a payment method first');
      setShowPaymentModal(true);
      return;
    }

    // Validate all cart items have valid quantities
    const invalidItem = cart.find(item => !item.quantity || isNaN(item.quantity) || item.quantity <= 0);
    if (invalidItem) {
      showToast(`Invalid quantity for ${invalidItem.medicineName}`);
      return;
    }

    try {
      // Ensure all quantities are valid numbers
      const validatedCart = cart.map(item => ({
        ...item,
        quantity: parseFloat(item.quantity) || 0,
        pricePerUnit: parseFloat(item.pricePerUnit) || 0,
        totalPrice: parseFloat(item.totalPrice) || 0
      }));

      const saleData = {
        items: validatedCart.map(item => ({
          ...item,
          // Ensure batchNo is always present to satisfy backend validation
          batchNo: item.batchNo || 'N/A',
          mlUsed: item.category === 'Injection' ? (item.mlUsed || 1) : 0,
          remainingMlAfterSale: item.category === 'Injection' ? 
            ((item.remainingMl || 0) - (item.mlUsed || 1)) : 0,
          expiryDate: item.expiryDate,
          dosage: item.dosage,
          // Store the actual sale price used in transaction (not original medicine price)
          actualSalePrice: item.pricePerUnit,
          actualTotalPrice: item.totalPrice
        })),
        subtotal: parseFloat(subtotal) || 0,
        discount: parseFloat(discount) || 0,
        paymentCharge: parseFloat(paymentCharge) || 0,
        totalAmount: parseFloat(totalAmount) || 0,
        receivedAmount: Math.max(0, parseFloat(receivedAmount)||0),
        previousDue: Math.max(0, parseFloat(previousDue)||0),
        dueAmount: Math.max(0, (parseFloat(totalAmount)||0) - (parseFloat(receivedAmount)||0)),
        newTotalDue: Math.max(0, (parseFloat(previousDue)||0) + ((parseFloat(totalAmount)||0) - (parseFloat(receivedAmount)||0))),
        paymentMethod: paymentMethod,
        customerName: customerInfo.customerName || 'Walk-in',
        customerContact: customerInfo.customerContact || '',
        petName: customerInfo.petName || '',
        patientId: customerInfo.patientId || '',
        clientId: customerInfo.clientId || '',
        species: customerInfo.species || '',
        breed: customerInfo.breed || '',
        sex: customerInfo.sex || '',
        age: customerInfo.age || '',
        weight: customerInfo.weight || '',
        address: customerInfo.address || '',
        followUpDate: customerInfo.followUpDate || '',
        comments: customerInfo.comments || '',
        soldBy: JSON.parse(localStorage.getItem('pharmacy_auth') || '{}').username || 'Pharmacy Staff'
      };

      const response = await pharmacySalesAPI.create(saleData);
      
      // Update remaining ML for injection medicines
      for (const item of validatedCart) {
        if (item.category === 'Injection' && item.mlUsed) {
          try {
            const medicine = medicines.find(m => m._id === item.medicineId);
            if (medicine) {
              const newRemainingMl = (medicine.remainingMl || medicine.mlPerVial || 0) - item.mlUsed;
              
              // If remaining ML is 0 or less, reduce vial quantity and reset remaining ML
              let updatedData;
              if (newRemainingMl <= 0) {
                updatedData = {
                  quantity: Math.max(0, medicine.quantity - 1),
                  remainingMl: medicine.mlPerVial || 0 // Reset to full vial for next vial
                };
              } else {
                updatedData = {
                  remainingMl: newRemainingMl
                };
              }
              
              await pharmacyMedicinesAPI.update(medicine._id, updatedData);
            }
          } catch (error) {
            console.error('Error updating medicine ML:', error);
          }
        }
      }
      
      // Merge sent fields with server response so nothing is lost
      const sale = response.data || {};
      const combinedSale = { ...saleData, ...sale };
      setLastSale(combinedSale);
      setShowReceipt(true);
      setShowPaymentModal(false);
      clearCart();
      fetchMedicines(); // Refresh stock
      showToast('Sale completed successfully');
      // Reset payment inputs for next patient
      setReceivedAmount(0);
      setPreviousDue(0);
      // Update backend dues for this client (fallback to local on failure)
      try {
        const id = combinedSale.clientId || combinedSale.customerContact || 'unknown';
        await pharmacyDuesAPI.upsert(id, {
          previousDue: Math.max(0, Number(combinedSale.newTotalDue||0)),
          name: combinedSale.customerName,
          customerContact: combinedSale.customerContact
        });
      } catch(e) {
        try {
          const map = getStoredDues();
          const id = combinedSale.clientId || combinedSale.customerContact || 'unknown';
          map[id] = Math.max(0, Number(combinedSale.newTotalDue||0));
          setStoredDues(map);
        } catch{}
      }
      // Optionally trigger print using Print button in receipt modal (no auto-print here)
    } catch (error) {
      console.error('Checkout error:', error);
      // Offline/network fallback: still show receipt and save sale locally for later sync
      if (!error?.response) {
        try {
          const localSale = { ...saleData, invoiceNumber: `PH-INV-LOCAL-${Date.now()}`, createdAt: new Date().toISOString() };
          const queue = JSON.parse(localStorage.getItem('pharmacy_offline_sales') || '[]');
          queue.push(localSale);
          localStorage.setItem('pharmacy_offline_sales', JSON.stringify(queue));
          setLastSale(localSale);
          setShowReceipt(true);
          setShowPaymentModal(false);
          clearCart();
          showToast('Network issue: saved sale locally and opened receipt');
          return;
        } catch (e) {
          // fallthrough to regular error toast
        }
      }
      showToast(error.response?.data?.message || error.message || 'Error processing sale');
    }
  };

  const printDualReceipts = (saleData = null, receiptTypeOverride = null) => {
    console.log('Print function called');
    const sale = saleData || lastSale;
    console.log('sale used for print:', sale);
    
    if (!sale) {
      showToast('No sale data found. Please complete a sale first.');
      return;
    }

    if (!sale.items || sale.items.length === 0) {
      showToast('No items in sale to print');
      return;
    }

    // Build ultra-simple, bold HTML for thermal receipts (80mm)
    // Pharmacy copy: detailed per-medicine rows
    // Compute pro-rata shares of paymentCharge to add into each item
    const baseSubtotalThermal = sale.items.reduce((s, it) => s + Number(it.totalPrice || 0), 0);
    const thermalCharge = Number(sale.paymentCharge || 0);
    const chargeShares = sale.items.map((it, i, arr) => {
      if (baseSubtotalThermal <= 0 || thermalCharge <= 0) return 0;
      if (i < arr.length - 1) return Number(((Number(it.totalPrice||0) / baseSubtotalThermal) * thermalCharge).toFixed(2));
      const prev = arr.slice(0, i).reduce((sum, x) => sum + Number(((Number(x.totalPrice||0) / baseSubtotalThermal) * thermalCharge).toFixed(2)), 0);
      return Number((thermalCharge - prev).toFixed(2));
    });

    let itemsHTML = '';
    sale.items.forEach((item, index) => {
      const share = chargeShares[index] || 0;
      const displayTotal = Number(item.totalPrice||0) + share;
      const qtyText = (item.category === 'Injection')
        ? ((item.mlUsed || item.quantity || 0) + 'ml')
        : (item.unit ? ((item.quantity||0) + ' ' + item.unit) : (item.quantity||0));
      itemsHTML += '<tr>'+
        '<td style="text-align:center;border:1px solid #000;padding:3px">'+(index+1)+'</td>'+
        '<td style="border:1px solid #000;padding:3px">'+(item.medicineName||'Item')+'</td>'+
        '<td style="text-align:center;border:1px solid #000;padding:3px">'+qtyText+'</td>'+
        '<td style="text-align:right;border:1px solid #000;padding:3px">Rs '+displayTotal.toFixed(2)+'</td>'+
      '</tr>';
    });

    // Patient copy: group by main category and show one line per category with total amount
    const categoryTotals = {};
    sale.items.forEach((item) => {
      const subCat = item.category || '';
      const mainCat = getMainCategory(subCat);
      const key = mainCat || 'Medicine';
      const idx = sale.items.indexOf(item);
      const share = chargeShares[idx] || 0;
      const amt = Number(item.totalPrice || 0) + share;
      categoryTotals[key] = (categoryTotals[key] || 0) + amt;
    });

    let patientItemsHTML = '';
    Object.entries(categoryTotals).forEach(([cat, amt], index) => {
      patientItemsHTML += '<tr>'+
        '<td style="text-align:center;border:1px solid #000;padding:3px">'+(index+1)+'</td>'+
        '<td style="border:1px solid #000;padding:3px">'+cat+'</td>'+
        '<td style="text-align:right;border:1px solid #000;padding:3px">Rs '+amt.toFixed(2)+'</td>'+
      '</tr>';
    });

    const subtotalVal = Number(sale.subtotal||0);
    const discountVal = Number(sale.discount||0);
    const grandTotal = Number(sale.totalAmount|| (subtotalVal - discountVal));
    const receivedVal = Number((sale.receivedAmount!=null? sale.receivedAmount : sale.totalAmount) || grandTotal);
    const receivableVal = Math.max(0, grandTotal - receivedVal);

    const totalsTableHTML = (
      '<table>'+
        '<tr><td style="border:1px solid #000;padding:3px">Total</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ (subtotalVal + Number(sale.paymentCharge||0)).toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px;color:#c00">Disc</td><td style="border:1px solid #000;padding:3px;text-align:right;color:#c00">'+ discountVal.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Prv. Dues</td><td style="border:1px solid #000;padding:3px;text-align:right">-</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">G.Total</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ grandTotal.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Received</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ receivedVal.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Receiveable</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ receivableVal.toLocaleString() +'</td></tr>'+
      '</table>'
    );

    const detailsTableHTML = (
      '<table>'+
        '<tr><td style="border:1px solid #000;padding:3px">Client ID</td><td style="border:1px solid #000;padding:3px">'+ (sale.clientId||'N/A') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Invoice #</td><td style="border:1px solid #000;padding:3px">'+ (sale.invoiceNumber||'N/A') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Contact</td><td style="border:1px solid #000;padding:3px">'+ (sale.customerContact||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Species</td><td style="border:1px solid #000;padding:3px">'+ (sale.species||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Breed</td><td style="border:1px solid #000;padding:3px">'+ (sale.breed||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Sex</td><td style="border:1px solid #000;padding:3px">'+ (sale.sex||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Age</td><td style="border:1px solid #000;padding:3px">'+ (sale.age||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Weight(kg)</td><td style="border:1px solid #000;padding:3px">'+ (sale.weight||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Address</td><td style="border:1px solid #000;padding:3px">'+ (sale.address||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Follow-up</td><td style="border:1px solid #000;padding:3px">'+ (sale.followUpDate? new Date(sale.followUpDate).toLocaleDateString() : '') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Comments</td><td style="border:1px solid #000;padding:3px">'+ (sale.comments||'') +'</td></tr>'+
      '</table>'
    );

    const name = (hospitalSettings?.hospitalName || hospitalSettings?.companyName || 'Pet Matrix');
    const addr = (hospitalSettings?.address || 'Main Boulevard, Gulshan-e-Iqbal, Karachi');
    const phone = (hospitalSettings?.phone || '+92-21-1234567');

    const headerHTML = '<div style="text-align:center;margin-bottom:6px">' +
      '<div style="font-size:14px">'+ name +'</div>' +
      '<div style="font-size:11px">'+ addr +'</div>' +
      '<div style="font-size:11px">Phone: '+ phone +'</div>' +
    '</div>';

    const footerHTML = '<div style="text-align:center;margin-top:10px;border-top:1px dashed #000;padding-top:8px">' +
      '<div>Thank you!</div>' +
      '<div>Powered by MindSpire</div>' +
    '</div>';

    // If a specific receipt type is requested (e.g. only PATIENT COPY),
    // build HTML accordingly. Otherwise print both Pharmacy & Patient copies.
    const isSinglePatientCopy = receiptTypeOverride && receiptTypeOverride.toUpperCase().includes('PATIENT');

    const printContent = isSinglePatientCopy ? (
      '<!doctype html><html><head><meta charset="utf-8" />'+
      '<title>Receipt</title>'+ 
      '<style>'+ 
      '@page{size:80mm auto;margin:2mm}'+
      'body{font-family:monospace;font-size:12px;margin:0;padding:2mm;color:#000;background:#fff;width:80mm;max-width:80mm;font-weight:bold}'+
      'table{width:100%;border-collapse:collapse;margin:5px 0}'+
      'th,td{border:1px solid #000;padding:3px}'+
      'th{text-align:center}'+
      '.title{background:#000;color:#fff;text-align:center;padding:4px 0;margin:6px 0}'+
      '.row{display:flex;justify-content:space-between}'+
      '.pb{padding-bottom:4px}'+
      '</style></head><body>'+ 
      headerHTML+
      '<div class="title">PATIENT COPY</div>'+ 
      '<table>'+
        '<tr><td style="border:1px solid #000;padding:3px">Patient ID</td><td style="border:1px solid #000;padding:3px">'+(sale.patientId||'N/A')+'</td><td style="border:1px solid #000;padding:3px">Date</td><td style="border:1px solid #000;padding:3px">'+new Date().toLocaleDateString()+'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Owner</td><td style="border:1px solid #000;padding:3px">'+(sale.customerName||'Walk-in')+'</td><td style="border:1px solid #000;padding:3px">Payment</td><td style="border:1px solid #000;padding:3px">'+(sale.paymentMethod||paymentMethod||'Cash')+'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Pet</td><td style="border:1px solid #000;padding:3px" colspan="3">'+(sale.petName||'N/A')+'</td></tr>'+
      '</table>'+ 
      detailsTableHTML+
      '<table><tr><th>S#</th><th>Medicine</th><th>Amount</th></tr>'+patientItemsHTML+'</table>'+ 
      totalsTableHTML+
      footerHTML+
      '</body></html>'
    ) : (
      '<!doctype html><html><head><meta charset="utf-8" />'+
      '<title>Receipt</title>'+ 
      '<style>'+ 
      '@page{size:80mm auto;margin:2mm}'+
      'body{font-family:monospace;font-size:12px;margin:0;padding:2mm;color:#000;background:#fff;width:80mm;max-width:80mm;font-weight:bold}'+
      'table{width:100%;border-collapse:collapse;margin:5px 0}'+
      'th,td{border:1px solid #000;padding:3px}'+
      'th{text-align:center}'+
      '.title{background:#000;color:#fff;text-align:center;padding:4px 0;margin:6px 0}'+
      '.row{display:flex;justify-content:space-between}'+
      '.pb{padding-bottom:4px}'+
      '.break{page-break-after:always;margin:0;padding:0;border:0;height:0}'+
      '</style></head><body>'+ 
      headerHTML+
      '<div class="title">PHARMACY COPY</div>'+ 
      '<table>'+
        '<tr><td style="border:1px solid #000;padding:3px">Patient ID</td><td style="border:1px solid #000;padding:3px">'+(sale.patientId||'N/A')+'</td><td style="border:1px solid #000;padding:3px">Date</td><td style="border:1px solid #000;padding:3px">'+new Date().toLocaleDateString()+'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Owner</td><td style="border:1px solid #000;padding:3px">'+(sale.customerName||'Walk-in')+'</td><td style="border:1px solid #000;padding:3px">Payment</td><td style="border:1px solid #000;padding:3px">'+(sale.paymentMethod||paymentMethod||'Cash')+'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Pet</td><td style="border:1px solid #000;padding:3px" colspan="3">'+(sale.petName||'N/A')+'</td></tr>'+
      '</table>'+ 
      detailsTableHTML+
      '<table><tr><th>S#</th><th>Medicine</th><th>Qty</th><th>Amount</th></tr>'+itemsHTML+'</table>'+ 
      totalsTableHTML+
      footerHTML+
      '<div class="break"></div>'+ 
      headerHTML+
      '<div class="title">PATIENT COPY</div>'+ 
      '<table>'+
        '<tr><td style="border:1px solid #000;padding:3px">Patient ID</td><td style="border:1px solid #000;padding:3px">'+(sale.patientId||'N/A')+'</td><td style="border:1px solid #000;padding:3px">Date</td><td style="border:1px solid #000;padding:3px">'+new Date().toLocaleDateString()+'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Owner</td><td style="border:1px solid #000;padding:3px">'+(sale.customerName||'Walk-in')+'</td><td style="border:1px solid #000;padding:3px">Payment</td><td style="border:1px solid #000;padding:3px">'+(sale.paymentMethod||paymentMethod||'Cash')+'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Pet</td><td style="border:1px solid #000;padding:3px" colspan="3">'+(sale.petName||'N/A')+'</td></tr>'+
      '</table>'+ 
      detailsTableHTML+
      '<table><tr><th>S#</th><th>Medicine</th><th>Amount</th></tr>'+patientItemsHTML+'</table>'+ 
      totalsTableHTML+
      footerHTML+
      '</body></html>'
    );

    setShowReceipt(false);

    // Reliable iframe-based printing (works better with thermal drivers)
    let printed = false;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    // Attach onload BEFORE writing to ensure it fires in all browsers
    iframe.onload = () => {
      try {
        setTimeout(()=>{
          if (printed) return;
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          printed = true;
          showToast('Opening print dialog...');
        }, 50);
      } catch (e) {
        console.error('Iframe print failed', e);
        showToast('Print failed. Check printer.');
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 1500);
      }
    };

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(printContent);
    iframeDoc.close();

    // As a fallback (some browsers ignore onload in data-write), trigger once if still not printed
    setTimeout(() => {
      if (printed) return;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        printed = true;
      } catch {}
    }, 150);

    // Final fallback to popup window after 800ms if nothing happened
    setTimeout(() => {
      if (printed) return;
      const w = window.open('', 'PrintWindow', 'width=400,height=600');
      if (!w) {
        showToast('Please allow popups to print');
        return;
      }
      w.document.open();
      w.document.write(printContent);
      w.document.close();
      setTimeout(() => {
        try { w.focus(); w.print(); } catch {}
        setTimeout(() => { try { w.close(); } catch {} }, 1500);
      }, 200);
    }, 800);
  };

  const generateReceiptContent = (receiptType) => {
    if (!lastSale || !lastSale.items) {
      return '<div>No sale data available</div>';
    }
    
    const isPharmacyCopy = receiptType.includes('PHARMACY COPY');
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${lastSale?.invoiceNumber || 'N/A'}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 2mm;
          }
          @media print {
            body {
              width: 80mm !important;
              margin: 0 !important;
              padding: 2mm !important;
            }
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            width: 80mm;
            max-width: 80mm;
            margin: 0;
            padding: 3mm;
            background: white;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 3px;
            font-size: 10px;
          }
          th, td {
            border: 1px solid #000;
            padding: 1px 2px;
            text-align: left;
            vertical-align: top;
            word-wrap: break-word;
          }
          th {
            background: #000;
            color: white;
            font-weight: bold;
            text-align: center;
            font-size: 9px;
          }
          .text-center {
            text-align: center;
          }
          .text-right {
            text-align: right;
          }
          .font-bold {
            font-weight: bold;
          }
          .header {
            text-align: center;
            margin-bottom: 5px;
            padding-bottom: 3px;
            border-bottom: 1px solid #000;
          }
          .hospital-info {
            text-align: center;
          }
          .hospital-name {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .hospital-address {
            font-size: 9px;
            line-height: 1.2;
          }
          .receipt-title {
            text-align: center;
            font-size: 11px;
            font-weight: bold;
            margin: 3px 0;
            padding: 2px;
            border: 1px solid #000;
            background: #000;
            color: white;
          }
          .logo {
            width: 50px;
            height: 50px;
            margin: 0 auto 5px;
            border: 1px solid #000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            background: #f0f0f0;
            font-size: 10px;
          }
          .logo img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .hospital-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 3px;
            text-transform: uppercase;
          }
          .hospital-address {
            font-size: 9px;
            line-height: 1.3;
          }
          thead {
            background: #f1f5f9;
          }
          th {
            padding: 4px 6px;
            text-align: center;
            font-size: 9px;
            font-weight: bold;
            border: 1px solid #000;
            background: #f8f8f8;
          }
          td {
            padding: 3px 5px;
            text-align: center;
            font-size: 9px;
            border: 1px solid #000;
            vertical-align: top;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          td:first-child {
            text-align: left;
            font-weight: 500;
          }
          .item-total {
            color: #10b981;
            font-weight: 600;
          }
          .totals-section {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            margin-bottom: 25px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
          }
          .total-row.discount {
            color: #f97316;
          }
          .total-row.final {
            border-top: 2px solid #cbd5e1;
            padding-top: 12px;
            margin-top: 8px;
          }
          .total-label {
            font-weight: 600;
          }
          .total-value {
            font-weight: 600;
          }
          .final .total-label {
            font-size: 18px;
            color: #1e293b;
          }
          .final .total-value {
            font-size: 20px;
            color: #10b981;
          }
          .footer {
            text-align: center;
            padding-top: 25px;
            border-top: 2px dashed #cbd5e1;
          }
          .thank-you {
            font-size: 16px;
            font-weight: 600;
            color: #475569;
            margin-bottom: 15px;
          }
          .powered-by {
            font-size: 11px;
            color: #94a3b8;
            font-style: italic;
          }
          .powered-by strong {
            color: #2563eb;
          }
          @media print {
            body {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <!-- Hospital Header -->
        <div class="header">
          ${hospitalSettings?.companyLogo ? `
            <div class="logo">
              <img src="${hospitalSettings.companyLogo}" alt="Hospital Logo" />
            </div>
          ` : ''}
          <div class="hospital-info">
            <div class="hospital-name">Pet Matrix</div>
            <div class="hospital-address">
              ${hospitalSettings?.address || 'Main Boulevard, Gulshan-e-Iqbal, Karachi'}<br>
              Phone: ${hospitalSettings?.phone || '+92-21-1234567'}
            </div>
          </div>
        </div>

        <div class="receipt-title">${receiptType}</div>

        <!-- Patient & Client Information Table -->
        <table>
          <tr>
            <td class="font-bold" style="background: #f0f0f0; width: 30%;">Patient ID:</td>
            <td style="width: 20%;">${lastSale?.patientId || customerInfo?.patientId || 'N/A'}</td>
            <td class="font-bold" style="background: #f0f0f0; width: 20%;">Date:</td>
            <td style="width: 30%;">${new Date().toLocaleDateString()}</td>
          </tr>
          <tr>
            <td class="font-bold" style="background: #f0f0f0;">Client ID:</td>
            <td>${lastSale?.clientId || customerInfo?.clientId || 'N/A'}</td>
            <td class="font-bold" style="background: #f0f0f0;">Invoice #</td>
            <td class="font-bold">${lastSale?.invoiceNumber || 'N/A'}</td>
          </tr>
          <tr>
            <td class="font-bold" style="background: #f0f0f0;">Owner:</td>
            <td>${lastSale?.customerName || customerInfo?.customerName || 'Walk-in'}</td>
            <td class="font-bold" style="background: #f0f0f0;">Pet:</td>
            <td>${lastSale?.petName || customerInfo?.petName || 'N/A'}</td>
          </tr>
          <tr>
            <td class="font-bold" style="background: #f0f0f0;">Species:</td>
            <td>${lastSale?.species || customerInfo?.species || 'N/A'}</td>
            <td class="font-bold" style="background: #f0f0f0;">Contact:</td>
            <td>${lastSale?.customerContact || customerInfo?.customerContact || 'N/A'}</td>
          </tr>
          <tr>
            <td class="font-bold" style="background: #f0f0f0;">Payment:</td>
            <td class="font-bold" style="color: #0066cc;" colspan="3">${lastSale?.paymentMethod || paymentMethod || 'Cash'}</td>
          </tr>
          ${(lastSale?.address || customerInfo?.address) ? `
          <tr>
            <td style="border: 1px solid #000; padding: 3px; background: #f0f0f0; font-weight: bold;">Address:</td>
            <td style="border: 1px solid #000; padding: 3px;" colspan="3">${lastSale?.address || customerInfo?.address}</td>
          </tr>
          ` : ''}
        </table>

        <!-- Items Table -->
        <table>
          <thead>
            <tr>
              <th style="width: 10%;">S#</th>
              ${isPharmacyCopy ? `
                <th style="width: 45%;">Medicine</th>
                <th style="width: 15%;">Rate</th>
                <th style="width: 15%;">Qty</th>
                <th style="width: 15%;">Total</th>
              ` : `
                <th style="width: 70%;">Medicine</th>
                <th style="width: 20%;">Amount</th>
              `}
            </tr>
          </thead>
          <tbody>
            ${isPharmacyCopy ? 
              // Show only actual medicines - no blank lines
              lastSale?.items.map((item, index) => `
                <tr>
                  <td class="text-center" style="padding: 2px; border: 1px solid #000;">${index + 1}</td>
                  <td style="padding: 2px; border: 1px solid #000;">
                    <div style="font-weight: bold; font-size: 13px;">${item.medicineName}</div>
                    ${item.dosage ? `<div style="font-size: 10px;">Dosage: ${item.dosage}</div>` : ''}
                    ${item.batchNo ? `<div style="font-size: 10px;">Batch: ${item.batchNo}</div>` : ''}
                  </td>
                  <td class="text-center" style="padding: 2px; border: 1px solid #000; font-size: 12px;">${(() => {
                    const subtotalSale = Number(lastSale?.subtotal||0);
                    const charge = Number(lastSale?.paymentCharge||0);
                    let share = 0;
                    if (subtotalSale > 0 && charge > 0) {
                      if (index < lastSale.items.length - 1) {
                        share = Number(((Number(item.totalPrice||0) / subtotalSale) * charge).toFixed(2));
                      } else {
                        const prevShares = lastSale.items.slice(0, index)
                          .reduce((s, it) => s + Number(((Number(it.totalPrice||0) / subtotalSale) * charge).toFixed(2)), 0);
                        share = Number((charge - prevShares).toFixed(2));
                      }
                    }
                    const qty = item.category === 'Injection' ? (Number(item.mlUsed||0) || 1) : (Number(item.quantity||0) || 1);
                    const baseRate = Number(item.actualSalePrice || item.pricePerUnit || 0);
                    const rateInc = qty > 0 ? (share / qty) : 0;
                    return (baseRate + rateInc).toFixed(2);
                  })()}</td>
                  <td class="text-center" style="padding: 2px; border: 1px solid #000; font-size: 12px;">
                    ${item.category === 'Injection' ? 
                      `${item.mlUsed || item.quantity}ml` : 
                      `${item.quantity} ${item.unit || ''}`
                    }
                  </td>
                  <td class="text-right font-bold" style="padding: 2px; border: 1px solid #000; font-size: 12px;">${(() => {
                    const subtotalSale = Number(lastSale?.subtotal||0);
                    const charge = Number(lastSale?.paymentCharge||0);
                    let share = 0;
                    if (subtotalSale > 0 && charge > 0) {
                      if (index < lastSale.items.length - 1) {
                        share = Number(((Number(item.totalPrice||0) / subtotalSale) * charge).toFixed(2));
                      } else {
                        const prevShares = lastSale.items.slice(0, index)
                          .reduce((s, it) => s + Number(((Number(it.totalPrice||0) / subtotalSale) * charge).toFixed(2)), 0);
                        share = Number((charge - prevShares).toFixed(2));
                      }
                    }
                    const displayTotal = Number(item.totalPrice||0) + share;
                    return displayTotal.toFixed(2);
                  })()}</td>
                </tr>
              `).join('')
              :
              // PATIENT COPY: Show actual medicines
              lastSale?.items.map((item, index) => `
                <tr>
                  <td class="text-center" style="padding: 2px; border: 1px solid #000;">${index + 1}</td>
                  <td style="padding: 2px; border: 1px solid #000; font-size: 13px; font-weight: bold;">${item.medicineName}</td>
                  <td class="text-right font-bold" style="padding: 2px; border: 1px solid #000; font-size: 12px;">${(() => {
                    const subtotalSale = Number(lastSale?.subtotal||0);
                    const charge = Number(lastSale?.paymentCharge||0);
                    let share = 0;
                    if (subtotalSale > 0 && charge > 0) {
                      if (index < lastSale.items.length - 1) {
                        share = Number(((Number(item.totalPrice||0) / subtotalSale) * charge).toFixed(2));
                      } else {
                        const prevShares = lastSale.items.slice(0, index)
                          .reduce((s, it) => s + Number(((Number(it.totalPrice||0) / subtotalSale) * charge).toFixed(2)), 0);
                        share = Number((charge - prevShares).toFixed(2));
                      }
                    }
                    const displayTotal = Number(item.totalPrice||0) + share;
                    return displayTotal.toFixed(2);
                  })()}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>

        <!-- Summary Section -->
        <div class="summary-section">
          <!-- Left side -->
          <div class="left-section">
            <table style="margin-bottom: 5px;">
              <tr>
                <td class="bg-gray font-bold" style="width: 30%;">Follow-up</td>
                <td>${lastSale?.followUpDate ? new Date(lastSale.followUpDate).toLocaleDateString() : ''}</td>
                <td class="bg-gray font-bold" style="width: 30%;">Vaccination follow-up</td>
              </tr>
            </table>
            
            <table>
              <tr>
                <td class="bg-gray font-bold text-center">Comments</td>
              </tr>
              <tr>
                <td style="height: 40px; vertical-align: top;">${lastSale?.comments || ''}</td>
              </tr>
            </table>
          </div>

          <!-- Right side -->
          <div class="right-section">
            <table>
              <tr>
                <td class="bg-gray font-bold">Total</td>
                <td class="text-right font-bold">${((Number(lastSale?.subtotal||0) + Number(lastSale?.paymentCharge||0))).toLocaleString()}</td>
              </tr>
              ${lastSale?.discount > 0 ? `
              <tr>
                <td class="bg-gray font-bold">Disc</td>
                <td class="text-right">${lastSale.discount.toLocaleString()}</td>
              </tr>` : ''}
              <tr>
                <td class="bg-gray font-bold">Prv. Dues</td>
                <td class="text-right">-</td>
              </tr>
              <tr>
                <td class="bg-gray font-bold">G.Total</td>
                <td class="text-right font-bold">${lastSale?.totalAmount.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="bg-gray font-bold">Received</td>
                <td class="text-right">${lastSale?.totalAmount.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="bg-gray font-bold">Receiveable</td>
                <td class="text-right">0</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Payment Information -->
        <table>
          <tr>
            <td class="bg-gray font-bold text-center">For online payment</td>
          </tr>
          <tr>
            <td class="text-center">Easypaisa / Raast</td>
          </tr>
          <tr>
            <td class="text-center font-bold">Saad Suliman</td>
          </tr>
          <tr>
            <td class="text-center font-bold">03450520451</td>
          </tr>
        </table>

        <div class="footer">
          <div style="font-size: 13px; font-weight: bold; margin-bottom: 3px;">Thank you for your purchase!</div>
          <div style="font-size: 10px;">Powered by <strong>MindSpire</strong></div>
          <div style="font-size: 10px; margin-top: 3px;">Visit Again!</div>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-[hsl(var(--pm-primary))] text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Header with Controls */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Point of Sale (POS)</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
              viewMode === 'grid' 
                ? 'bg-[hsl(var(--pm-primary))] text-white shadow-sm' 
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <FiGrid className="w-4 h-4" />
            Grid View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
              viewMode === 'list' 
                ? 'bg-[hsl(var(--pm-primary))] text-white shadow-sm' 
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <FiList className="w-4 h-4" />
            List View
          </button>
          <button
            onClick={() => setHideInventory(!hideInventory)}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
              hideInventory 
                ? 'bg-slate-700 text-white shadow-md' 
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <FiEyeOff className="w-4 h-4" />
            Hide Inventory
          </button>
          <button
            className="px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all"
          >
            <FiMaximize2 className="w-4 h-4" />
            Scan Barcode
          </button>
          <button
            onClick={clearCart}
            className="px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 shadow-md transition-all"
          >
            <FiTrash2 className="w-4 h-4" />
            Clear Cart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product Search & Selection */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search medicine name or scan barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const q = (searchQuery || '').trim().toLowerCase();
                    const exact = medicines.find(m => (m.barcode || '').toLowerCase() === q);
                    if (exact) {
                      addToCart(exact);
                      return;
                    }
                    if (searchMedicines.length > 0) {
                      addToCart(searchMedicines[0]);
                    } else {
                      showToast('Medicine not found');
                    }
                  }
                }}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))] text-lg"
                autoFocus
              />
            </div>
          </div>

          {/* Products Grid/List */}
          {!hideInventory && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(searchQuery ? searchMedicines : medicines.slice(0, 12)).map(medicine => (
                    <div
                      key={medicine._id}
                      className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <h3 className="font-semibold text-slate-800 text-base mb-1">{medicine.medicineName}</h3>
                      <p className="text-xs text-slate-500 mb-1">Batch: {medicine.batchNo}</p>
                      {medicine.category === 'Injection' ? (
                        <div className="text-sm text-slate-500 mb-3">
                          <p>Available: {medicine.remainingMl || medicine.mlPerVial || 0} ml</p>
                          <p>Per {medicine.containerType || 'Vial'}: {medicine.mlPerVial || 0} ml</p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 mb-3">Stock: {medicine.quantity} {medicine.unit}</p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-500">Rs</span>
                          <span className="text-lg font-bold text-[hsl(var(--pm-primary))]">{medicine.salePrice}</span>
                        </div>
                        <button 
                          onClick={() => addToCart(medicine)}
                          className="px-4 py-2 bg-[hsl(var(--pm-primary))] text-white text-sm rounded-lg hover:bg-[hsl(var(--pm-primary-hover))] flex items-center gap-1 font-medium"
                        >
                          <FiPlus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {(searchQuery ? searchMedicines : medicines.slice(0, 12)).map(medicine => (
                    <div
                      key={medicine._id}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                      onClick={() => addToCart(medicine)}
                    >
                      <div>
                        <h3 className="font-semibold text-slate-800">{medicine.medicineName}</h3>
                        <p className="text-xs text-slate-500">Batch: {medicine.batchNo}</p>
                        {medicine.category === 'Injection' ? (
                          <div className="text-sm text-slate-500">
                            <p>Available: {medicine.remainingMl || medicine.mlPerVial || 0} ml</p>
                            <p>Per {medicine.containerType || 'Vial'}: {medicine.mlPerVial || 0} ml</p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">Stock: {medicine.quantity} {medicine.unit}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-lg font-bold text-slate-800">Rs {medicine.salePrice}</p>
                        <button className="px-4 py-2 bg-[hsl(var(--pm-primary))] text-white rounded hover:bg-[hsl(var(--pm-primary-hover))]">
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Shopping Cart & Checkout */}
        <div className="space-y-4">
          {/* Shopping Cart */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-4">Shopping Cart ({cart.length})</h3>

            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FiShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.medicineId} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800">{item.medicineName}</h4>
                        <p className="text-xs text-slate-500">Batch: {item.batchNo} | {item.category}</p>
                        {item.dosage && (
                          <p className="text-xs text-slate-500 mt-0.5">Dosage: {item.dosage}</p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span>Price: Rs</span>
                          {editingItem === `${item.medicineId}_price` ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={item.pricePerUnit}
                                onChange={(e) => updatePrice(item.medicineId, parseFloat(e.target.value) || 0)}
                                className="w-20 text-center border border-slate-300 rounded px-2 py-1 text-sm"
                                min="0"
                                step="0.01"
                                autoFocus
                              />
                              <button 
                                onClick={() => setEditingItem(null)}
                                className="p-1 text-[hsl(var(--pm-primary))] hover:bg-[hsl(var(--pm-primary-soft))] rounded"
                              >
                                <FiSave className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{item.pricePerUnit}</span>
                              <button 
                                onClick={() => setEditingItem(`${item.medicineId}_price`)}
                                className="p-1 text-[hsl(var(--pm-primary))] hover:bg-[hsl(var(--pm-primary-soft))] rounded"
                              >
                                <FiEdit3 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.medicineId)}
                        className="text-red-600 hover:bg-red-50 p-1 rounded"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      {item.category === 'Injection' ? (
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-sm font-medium text-slate-700">ML:</span>
                          {editingItem === item.medicineId ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={item.mlUsed || 1}
                                onChange={(e) => updateMlUsed(item.medicineId, parseFloat(e.target.value) || 0)}
                                className="w-20 text-center border border-slate-300 rounded px-2 py-1"
                                min="0.1"
                                max={item.remainingMl}
                                step="0.1"
                                autoFocus
                              />
                              <button 
                                onClick={() => setEditingItem(null)}
                                className="p-1 text-[hsl(var(--pm-primary))] hover:bg-[hsl(var(--pm-primary-soft))] rounded"
                              >
                                <FiSave className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[hsl(var(--pm-primary))]">{item.mlUsed || 1}ml</span>
                              <button 
                                onClick={() => setEditingItem(item.medicineId)}
                                className="p-1 text-[hsl(var(--pm-primary))] hover:bg-[hsl(var(--pm-primary-soft))] rounded"
                              >
                                <FiEdit3 className="w-4 h-4" />
                              </button>
                              <span className="text-sm text-slate-500">/ {(() => {
                                const cap = Math.max(1, Number(item.mlPerVial || 1));
                                const total = Math.max(0, Number(item.remainingMl || 0)) + Math.max(0, Number(item.availableStock || 0)) * cap;
                                return total;
                              })()}ml available</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {Number(item.mlPerVial || 0) > 0 ? (
                            <div className="flex items-center gap-2 w-full">
                              <span className="text-sm font-medium text-slate-700">Dose (ml):</span>
                              <input
                                type="number"
                                value={Number(item.doseRequested || 0)}
                                onChange={(e) => updateDose(item.medicineId, parseFloat(e.target.value) || 0)}
                                className="w-24 text-center border border-slate-300 rounded px-2 py-1"
                                min="0.1"
                                step="0.1"
                              />
                              <span className="text-sm text-slate-500">
                                = {Math.max(1, Math.ceil(Number(item.doseRequested || 0) / (Number(item.mlPerVial) || 1)))} x {item.unit || 'unit'} ({Number(item.mlPerVial || 0)} ml/{item.containerType || 'vial'})
                              </span>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => updateQuantity(item.medicineId, item.quantity - 1)}
                                className="p-1 border border-slate-300 rounded hover:bg-slate-100"
                              >
                                <FiMinus className="w-4 h-4" />
                              </button>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.medicineId, Number(e.target.value))}
                                className="w-16 text-center border border-slate-300 rounded px-2 py-1"
                                min="1"
                                step="0.1"
                              />
                              <span className="text-sm text-slate-600">{item.unit}</span>
                              <button
                                onClick={() => updateQuantity(item.medicineId, item.quantity + 1)}
                                className="p-1 border border-slate-300 rounded hover:bg-slate-100"
                              >
                                <FiPlus className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-sm text-slate-600">Total:</span>
                      <span className="text-lg font-bold text-[hsl(var(--pm-primary))]">Rs{item.totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bill Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Bill Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold">PKR {subtotal.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center text-slate-600">
                <span>Discount:</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="w-20 px-2 py-1 border border-slate-300 rounded text-right"
                  min="0"
                />
              </div>

              <div className="border-t border-slate-200 pt-2 mt-2">
                <div className="flex justify-between text-lg font-bold text-slate-800">
                  <span>Total Amount:</span>
                  <span>PKR {totalAmount.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Received</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={receivedAmount}
                      onChange={(e)=>setReceivedAmount(Number(e.target.value)||0)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Receivable</label>
                    <div className="w-full px-2 py-1 border border-slate-200 rounded bg-gray-50 text-right">
                      PKR {combinedDue.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                // Auto-generate IDs if empty
                if (!customerInfo.patientId) {
                  setCustomerInfo(prev => ({
                    ...prev,
                    patientId: generatePatientId(),
                    clientId: generateClientId()
                  }));
                }
                setShowPaymentModal(true);
              }}
              disabled={cart.length === 0}
              className="w-full mt-4 py-3 bg-[hsl(var(--pm-primary))] hover:bg-[hsl(var(--pm-primary-hover))] disabled:bg-slate-300 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <FiShoppingCart className="w-5 h-5" />
              Process Payment
            </button>
          </div>
        </div>
      </div>

      {/* Payment Processing Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">Process Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {/* Patient & Client IDs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Patient ID</label>
                  <input
                    type="text"
                    placeholder="Auto-generated"
                    value={customerInfo.patientId}
                    onChange={(e) => setCustomerInfo({...customerInfo, patientId: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
                  <input
                    type="text"
                    placeholder="Auto-generated"
                    value={customerInfo.clientId}
                    onChange={(e) => setCustomerInfo({...customerInfo, clientId: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))] text-sm"
                  />
                </div>
              </div>

              {/* Customer Details */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  placeholder="Customer full name"
                  value={customerInfo.customerName}
                  onChange={(e) => setCustomerInfo({...customerInfo, customerName: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="03xx-xxxxxxx"
                    value={customerInfo.customerContact}
                    onChange={(e) => setCustomerInfo({...customerInfo, customerContact: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    placeholder="Customer address"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                  />
                </div>
              </div>

              {/* Pet Details */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Pet Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pet Name</label>
                    <input
                      type="text"
                      placeholder="Pet name"
                      value={customerInfo.petName}
                      onChange={(e) => setCustomerInfo({...customerInfo, petName: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Species</label>
                    <select
                      value={customerInfo.species}
                      onChange={(e) => setCustomerInfo({...customerInfo, species: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                    >
                      <option value="">Select species</option>
                      <option value="Felis silvestris Catus">Felis silvestris Catus</option>
                      <option value="Canis lupus familiaris">Canis lupus familiaris</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Breed</label>
                    <input
                      type="text"
                      placeholder="Breed"
                      value={customerInfo.breed}
                      onChange={(e) => setCustomerInfo({...customerInfo, breed: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sex</label>
                    <select
                      value={customerInfo.sex}
                      onChange={(e) => setCustomerInfo({...customerInfo, sex: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
                    <input
                      type="text"
                      placeholder="5Y/9M/11D"
                      value={customerInfo.age}
                      onChange={(e) => setCustomerInfo({...customerInfo, age: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Weight (kg)</label>
                    <input
                      type="text"
                      placeholder="0.0"
                      value={customerInfo.weight}
                      onChange={(e) => setCustomerInfo({...customerInfo, weight: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Follow-up Date</label>
                    <input
                      type="date"
                      value={customerInfo.followUpDate}
                      onChange={(e) => setCustomerInfo({...customerInfo, followUpDate: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                    />
                  </div>
                </div>

              {/* Payment Method Selection */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {availableMethods.map(m => (
                    <button key={m} onClick={()=>setPaymentMethod(m)} className={paymentMethod===m ? 'px-3 py-2 rounded-lg border text-sm bg-[hsl(var(--pm-primary))] text-white border-[hsl(var(--pm-primary))]' : 'px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50 border-gray-300'}>
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add new method (e.g. Bank ABC)"
                    value={newMethodName}
                    onChange={(e)=>setNewMethodName(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                  />
                  <button onClick={addPaymentMethod} className="px-4 py-2 bg-[hsl(var(--pm-primary))] text-white rounded-lg hover:bg-[hsl(var(--pm-primary-hover))]">Add</button>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>PKR {(subtotal + Number(paymentCharge||0)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>PKR {discount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Payment Charges (2% non-cash):</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentCharge}
                        onChange={(e)=>{ setPaymentCharge(Math.max(0, Number(e.target.value)||0)); setIsChargeManual(true); }}
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-right bg-white"
                      />
                      <button onClick={()=>setIsChargeManual(false)} className="text-xs text-[hsl(var(--pm-primary))] hover:underline">Auto</button>
                    </div>
                  </div>
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total Amount:</span>
                    <span>PKR {totalAmount.toLocaleString()}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Received Amount</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={receivedAmount}
                        onChange={(e)=>{ setReceivedTouched(true); setReceivedAmount(Number(e.target.value)||0); }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/25 focus:border-[hsl(var(--pm-primary))]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Pending/Due</label>
                      <div className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                        PKR {Math.max(0, (Number(totalAmount)||0) - (Number(receivedAmount)||0)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={processSale}
                  disabled={isProcessing || !paymentMethod}
                  className="flex-1 px-4 py-2 bg-[hsl(var(--pm-primary))] text-white rounded-lg hover:bg-[hsl(var(--pm-primary-hover))] disabled:opacity-50"
                >
                  {isProcessing ? 'Processing...' : (paymentMethod? `Pay with ${paymentMethod}` : 'Select Method')}
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Receipt Modal (Shop-style) */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="font-semibold">Receipt</div>
              <button onClick={() => setShowReceipt(false)} className="text-slate-400 hover:text-slate-600"><FiX className="w-5 h-5"/></button>
            </div>
            <div ref={receiptRef} className="p-4 text-sm">
              <div className="text-center mb-3">
                <div className="font-bold text-lg">{hospitalSettings?.companyName || 'Pet Matrix'}</div>
                <div className="text-slate-500">{hospitalSettings?.address || 'Main Boulevard, Gulshan-e-Iqbal, Karachi'}</div>
                <div className="text-slate-500">{hospitalSettings?.phone ? `Phone: ${hospitalSettings.phone}` : ''}</div>
              </div>

              <table className="w-full text-sm mb-3 border border-slate-200">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-2"><span className="text-slate-500">Patient ID</span></td>
                    <td className="p-2 text-right"><strong>{lastSale?.patientId || 'N/A'}</strong></td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2"><span className="text-slate-500">Date</span></td>
                    <td className="p-2 text-right">{new Date(lastSale?.createdAt).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="p-2"><span className="text-slate-500">Client</span></td>
                    <td className="p-2 text-right">{lastSale?.customerName || 'Walk-in'}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-2">Item</th>
                    <th className="p-2">Qty</th>
                    <th className="p-2">Price</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSale?.items?.map((i,idx)=> {
                    const subtotalSale = Number(lastSale?.subtotal||0);
                    const charge = Number(lastSale?.paymentCharge||0);
                    let share = 0;
                    if (subtotalSale > 0 && charge > 0) {
                      if (idx < lastSale.items.length - 1) {
                        share = Number(((Number(i.totalPrice||0) / subtotalSale) * charge).toFixed(2));
                      } else {
                        const prevShares = lastSale.items.slice(0, idx)
                          .reduce((s, it) => s + Number(((Number(it.totalPrice||0) / subtotalSale) * charge).toFixed(2)), 0);
                        share = Number((charge - prevShares).toFixed(2));
                      }
                    }
                    const displayTotal = Number(i.totalPrice||0) + share;
                    return (
                      <tr key={idx} className="border-b">
                        <td className="p-2">{i.medicineName}</td>
                        <td className="p-2 text-center">{i.category==='Injection' ? `${i.mlUsed||1}ml` : i.quantity}</td>
                        <td className="p-2 text-center">Rs{(i.actualSalePrice||i.pricePerUnit||0).toLocaleString()}</td>
                        <td className="p-2 text-right">Rs{displayTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-2 space-y-1 text-right">
                <div>Subtotal: <strong>Rs{(((lastSale?.subtotal||0) + (lastSale?.paymentCharge||0))||0).toLocaleString()}</strong></div>
                {lastSale?.discount>0 && <div>Discount: <strong>-Rs{(lastSale?.discount||0).toLocaleString()}</strong></div>}
                <div className="text-lg">Total: <strong>Rs{(lastSale?.totalAmount||0).toLocaleString()}</strong></div>
                <div>Received ({lastSale?.paymentMethod||paymentMethod||'Cash'}): <strong>Rs{((lastSale?.receivedAmount ?? lastSale?.totalAmount ?? 0)).toLocaleString()}</strong></div>
                {((lastSale?.dueAmount||0) > 0) && <div>Balance Due: <strong>Rs{(lastSale?.dueAmount||0).toLocaleString()}</strong></div>}
              </div>

              <div className="text-center mt-3 text-xs text-slate-500">
                <div>No return or exchange without receipt. Goods once sold will not be taken back.</div>
              </div>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold"
              >
                OK
              </button>
              <button
                onClick={() => printDualReceipts(lastSale, 'PATIENT COPY')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[hsl(var(--pm-primary))] hover:bg-[hsl(var(--pm-primary-hover))] text-white rounded-lg font-semibold"
              >
                <FiPrinter /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
