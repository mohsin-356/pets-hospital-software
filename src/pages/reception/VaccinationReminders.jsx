import React, { useState, useEffect, useMemo } from 'react';
import { FiRefreshCw, FiSend, FiCheck, FiAlertCircle, FiCalendar, FiMessageCircle, FiTrash2, FiSearch, FiFilter } from 'react-icons/fi';
import { vaccinationReminderAPI, petsAPI, settingsAPI } from '../../services/api';
import { useActivity } from '../../context/ActivityContext';

export default function VaccinationReminders() {
  const [reminders, setReminders] = useState([]);
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, sent, upcoming
  const [searchQuery, setSearchQuery] = useState('');
  const [clinicName, setClinicName] = useState('Pets Hospital');
  const { addActivity } = useActivity();

  useEffect(() => {
    fetchReminders();
    fetchPets();
    fetchClinicName();
  }, []);

  const fetchClinicName = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await settingsAPI.get(user.username || 'admin');
      const name = response.data?.hospitalName || response.data?.clinicName || 'Pets Hospital';
      setClinicName(name);
    } catch (error) {
      console.error('Error fetching clinic name:', error);
    }
  };

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const response = await vaccinationReminderAPI.getAll();
      setReminders(response.data || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
      showToast('Error loading reminders');
    } finally {
      setLoading(false);
    }
  };

  const fetchPets = async () => {
    try {
      const response = await petsAPI.getAll();
      setPets(response.data || []);
    } catch (error) {
      console.error('Error fetching pets:', error);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await vaccinationReminderAPI.syncFromPets(clinicName);
      showToast(response.message || `Synced ${response.data?.length || 0} new reminders`);
      await fetchReminders();
      try {
        addActivity({ user: 'Reception', text: `Synced vaccination reminders from pet records` });
      } catch {}
    } catch (error) {
      console.error('Error syncing reminders:', error);
      showToast('Error syncing reminders');
    } finally {
      setSyncing(false);
    }
  };

  const handleSendWhatsApp = async (reminder) => {
    try {
      // Get WhatsApp link
      const response = await vaccinationReminderAPI.getWhatsAppLink(reminder.id);
      const { waLink, message } = response.data;
      
      // Open WhatsApp
      window.open(waLink, '_blank');
      
      // Mark as sent
      await vaccinationReminderAPI.markSent(reminder.id, { sentVia: 'WhatsApp' });
      
      // Update local state
      setReminders(prev => prev.map(r => 
        r.id === reminder.id 
          ? { ...r, reminderSent: true, reminderSentAt: new Date(), status: 'Sent' }
          : r
      ));
      
      showToast(`WhatsApp opened for ${reminder.petName}`);
      try {
        addActivity({ user: 'Reception', text: `Sent vaccination reminder to ${reminder.ownerName} for ${reminder.petName}` });
      } catch {}
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      showToast('Error opening WhatsApp');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;
    
    try {
      await vaccinationReminderAPI.delete(id);
      setReminders(prev => prev.filter(r => r.id !== id));
      showToast('Reminder deleted');
    } catch (error) {
      console.error('Error deleting reminder:', error);
      showToast('Error deleting reminder');
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const filteredReminders = useMemo(() => {
    let filtered = reminders;
    
    // Filter by status
    if (filter === 'pending') {
      filtered = filtered.filter(r => !r.reminderSent && r.status === 'Pending');
    } else if (filter === 'sent') {
      filtered = filtered.filter(r => r.reminderSent);
    } else if (filter === 'upcoming') {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      filtered = filtered.filter(r => {
        const dueDate = new Date(r.nextDueDate);
        return dueDate >= today && dueDate <= nextWeek && !r.reminderSent;
      });
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.petName?.toLowerCase().includes(q) ||
        r.ownerName?.toLowerCase().includes(q) ||
        r.vaccineName?.toLowerCase().includes(q) ||
        r.ownerContact?.includes(q)
      );
    }
    
    return filtered.sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));
  }, [reminders, filter, searchQuery]);

  const getStatusBadge = (reminder) => {
    if (reminder.reminderSent) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
          <FiCheck className="w-3 h-3" /> Sent
        </span>
      );
    }
    const daysUntil = Math.ceil((new Date(reminder.nextDueDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <FiAlertCircle className="w-3 h-3" /> Overdue
        </span>
      );
    } else if (daysUntil <= 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <FiCalendar className="w-3 h-3" /> Due Soon
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <FiCalendar className="w-3 h-3" /> Upcoming
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vaccination Reminders</h1>
          <p className="text-slate-500 mt-1">Send automatic WhatsApp reminders for pet vaccinations</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <FiRefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from Pets'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-800">{reminders.length}</div>
          <div className="text-sm text-slate-500">Total Reminders</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-amber-600">
            {reminders.filter(r => !r.reminderSent).length}
          </div>
          <div className="text-sm text-slate-500">Pending</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-emerald-600">
            {reminders.filter(r => r.reminderSent).length}
          </div>
          <div className="text-sm text-slate-500">Sent</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-red-600">
            {reminders.filter(r => {
              const daysUntil = Math.ceil((new Date(r.nextDueDate) - new Date()) / (1000 * 60 * 60 * 24));
              return daysUntil < 0 && !r.reminderSent;
            }).length}
          </div>
          <div className="text-sm text-slate-500">Overdue</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by pet name, owner, or vaccine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setFilter('sent')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Sent
            </button>
          </div>
        </div>
      </div>

      {/* Reminders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredReminders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <FiCalendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700">No reminders found</h3>
          <p className="text-slate-500 mt-1">Click "Sync from Pets" to generate reminders from pet vaccination records</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Pet / Owner</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Vaccine</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Last Given</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Next Due</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredReminders.map((reminder) => (
                  <tr key={reminder.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{reminder.petName}</div>
                      <div className="text-sm text-slate-500">{reminder.ownerName}</div>
                      <div className="text-sm text-slate-400">{reminder.ownerContact}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{reminder.vaccineName}</div>
                      {reminder.shotStage && (
                        <div className="text-sm text-slate-500">{reminder.shotStage}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {reminder.lastVaccinationDate 
                        ? new Date(reminder.lastVaccinationDate).toLocaleDateString('en-GB')
                        : 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(reminder.nextDueDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(reminder)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {!reminder.reminderSent && reminder.ownerContact && (
                          <button
                            onClick={() => handleSendWhatsApp(reminder)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm"
                          >
                            <FiMessageCircle className="w-4 h-4" />
                            WhatsApp
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(reminder.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
