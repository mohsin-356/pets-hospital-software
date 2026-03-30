import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';

const normalize = (v) => String(v || '').trim().toLowerCase();

const safeString = (v) => String(v || '').trim();

const buildInventoryId = () => new mongoose.Types.ObjectId().toString();

export const upsertInventoryForProduct = async (product) => {
  if (!product) return null;

  const department = 'shop';
  const company = safeString(product.company);
  const barcode = safeString(product.barcode);
  const itemName = safeString(product.itemName);

  const byBarcode = barcode ? await Inventory.findOne({ department, company, barcode }) : null;
  const byName = !byBarcode && itemName ? await Inventory.findOne({ department, company, itemName }) : null;

  const inv = byBarcode || byName;

  const payload = {
    itemName: itemName || inv?.itemName || 'Unnamed Item',
    category: safeString(product.category) || inv?.category || 'Other',
    type: inv?.type || 'Other',
    quantity: Number(product.quantity || 0),
    unit: inv?.unit || 'pcs',
    price: Number(product.purchasePrice || product.salePrice || 0) || 0,
    supplier: safeString(product.supplier) || inv?.supplier || '',
    minStockLevel: Number(product.lowStockThreshold ?? inv?.minStockLevel ?? 10) || 10,
    status: inv?.status || 'In Stock',
    department,
    createdBy: inv?.createdBy || 'system',
    company: company || inv?.company || '',
    barcode: barcode || inv?.barcode || ''
  };

  if (inv) {
    return Inventory.findByIdAndUpdate(inv._id, { $set: payload }, { new: true, runValidators: true });
  }

  const created = await Inventory.create({
    id: buildInventoryId(),
    ...payload
  });
  return created;
};

export const upsertInventoryForMedicine = async (medicine) => {
  if (!medicine) return null;

  const department = 'pharmacy';
  const barcode = safeString(medicine.barcode);
  const medicineName = safeString(medicine.medicineName);
  const batchNo = safeString(medicine.batchNo);

  const byBarcode = barcode ? await Inventory.findOne({ department, barcode }) : null;
  const byNameBatch = !byBarcode && medicineName && batchNo
    ? await Inventory.findOne({ department, itemName: medicineName, batchNumber: batchNo })
    : null;

  const inv = byBarcode || byNameBatch;

  const isInjection = normalize(medicine.category) === 'injection';
  const qty = isInjection
    ? Number(medicine.remainingMl ?? ((Number(medicine.mlPerVial || 0) * Number(medicine.quantity || 0)) || 0))
    : Number(medicine.quantity || 0);

  const unit = isInjection ? 'ml' : (safeString(medicine.unit) || 'pieces');

  const payload = {
    itemName: medicineName || inv?.itemName || 'Unnamed Medicine',
    category: safeString(medicine.category) || inv?.category || 'Medicine',
    type: 'Medicine',
    quantity: qty,
    unit: inv?.unit || unit,
    price: Number(medicine.purchasePrice || medicine.salePrice || 0) || 0,
    supplier: safeString(medicine.supplierName) || inv?.supplier || '',
    expiryDate: medicine.expiryDate || inv?.expiryDate,
    batchNumber: batchNo || inv?.batchNumber || '',
    minStockLevel: Number(medicine.lowStockThreshold ?? inv?.minStockLevel ?? 10) || 10,
    status: inv?.status || 'In Stock',
    department,
    createdBy: inv?.createdBy || 'system',
    barcode: barcode || inv?.barcode || ''
  };

  if (inv) {
    return Inventory.findByIdAndUpdate(inv._id, { $set: payload }, { new: true, runValidators: true });
  }

  const created = await Inventory.create({
    id: buildInventoryId(),
    ...payload
  });
  return created;
};

export const adjustInventoryQuantity = async ({ inventoryItemId, delta }) => {
  if (!inventoryItemId) return null;
  const d = Number(delta || 0);
  if (!d) return null;
  return Inventory.findByIdAndUpdate(
    inventoryItemId,
    { $inc: { quantity: d } },
    { new: true }
  );
};

export const setInventoryQuantity = async ({ inventoryItemId, quantity }) => {
  if (!inventoryItemId) return null;
  const q = Number(quantity || 0);
  return Inventory.findByIdAndUpdate(
    inventoryItemId,
    { $set: { quantity: q } },
    { new: true }
  );
};
