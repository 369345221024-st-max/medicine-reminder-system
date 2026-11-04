import { ref, reactive, computed } from 'vue';
import { supabase } from './supabase.js';

// State
export const medications = ref([]);
export const loading = ref(true);
export const errorMsg = ref('');
export const takenList = ref([]); 
export const historyLogs = ref([]); 
export const selectedDate = ref(new Date().toISOString().substring(0, 10)); 
export const activeAlerts = ref([]); 
export const dismissedMedKeys = ref(new Set()); // เก็บ key ที่ทานแล้ว/ปิดแล้วในรอบนี้
export const notice = ref('');
export const TARGET_DOSAGE = 200;
export const auth = reactive({ loggedIn: false });

export const user = ref(null);

export const authReady = supabase.auth.getSession().then(({ data }) => {
  user.value = data.session?.user ?? null;
});

supabase.auth.onAuthStateChange((_event, session) => {
  user.value = session?.user ?? null;
});

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : '';
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Computed
export const totalDosage = computed(() =>
  takenList.value.reduce((sum, item) => sum + (Number(item.dosage || item.dose || item.price) || 0), 0)
);

export const itemCount = computed(() => takenList.value.length);
export const totalCount = computed(() => medications.value.length);

export const progress = computed(() => Math.min(100, Math.round((totalDosage.value / TARGET_DOSAGE) * 100)));
export const remaining = computed(() => Math.max(0, TARGET_DOSAGE - totalDosage.value));

// Actions (บันทึกการกินยา)
export const takeMedicine = async (medication) => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const todayStr = now.toISOString().substring(0, 10);
  
  // บันทึก key ป้องกันการแจ้งเตือนซ้ำในวันและเวลานี้
  const alertKey = `${medication.id}_${todayStr}_${medication.alertTime || medication.reminder_time || medication.time}`;
  dismissedMedKeys.value.add(alertKey);

  const logItem = {
    ...medication,
    takenAt: timeStr
  };
  takenList.value.push(logItem);

  const { error } = await supabase.from('medication_logs').insert({
    medication_id: medication.id,
    medication_name: medication.medication_name || medication.title || medication.name,
    dosage: Number(medication.dosage || medication.dose || medication.price || 0),
    scheduled_time: medication.reminder_time || medication.time,
    taken_at: now.toISOString()
  });

  if (error) console.error('บันทึกประวัติล้มเหลว:', error);
};

export async function loadHistoryByDate(dateStr) {
  selectedDate.value = dateStr;
  const startDate = `${dateStr}T00:00:00.000Z`;
  const endDate = `${dateStr}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from('medication_logs')
    .select('*')
    .gte('taken_at', startDate)
    .lte('taken_at', endDate)
    .order('taken_at', { ascending: false });

  if (error) {
    console.error('โหลดประวัติย้อนหลังไม่สำเร็จ:', error);
    return;
  }

  historyLogs.value = data || [];
}

export const clearTakenList = () => {
  takenList.value = [];
};

// Fetch Data (ดึงรายการยาและเรียงลำดับเวลา)
export async function loadMedications() {
  if (medications.value.length === 0) loading.value = true;
  errorMsg.value = '';
  
  const { data, error } = await supabase
    .from('medication_reminders')
    .select('*');

  if (error) {
    errorMsg.value = 'โหลดข้อมูลยาไม่สำเร็จ กรุณาลองใหม่';
    console.error('Fetch Error:', error);
  } else if (data) {
    medications.value = data.sort((a, b) => {
      const timeA = a.reminder_time || a.time || '00:00';
      const timeB = b.reminder_time || b.time || '00:00';
      return timeA.localeCompare(timeB);
    });
  }
  loading.value = false;
}

// Add Medication
export async function addMedication(newItem) {
  const payload = {
    medication_name: newItem.medication_name || newItem.name || newItem.title,
    dosage: String(newItem.dosage || newItem.dose || 0),
    reminder_time: newItem.reminder_time || newItem.time,
    image_url: newItem.image_url || null
  };

  const { error } = await supabase.from('medication_reminders').insert([payload]);
  
  if (error) {
    console.error('Insert Error:', error);
    alert('บันทึกไม่สำเร็จ: ' + error.message);
    return error.message;
  }
  
  await loadMedications();
  return '';
}

// Realtime
export const liveMsg = ref('');
let channel = null;

export function startRealtime() {
  if (channel) return;
  channel = supabase
    .channel('medications-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'medication_reminders' },
      () => {
        liveMsg.value = 'มีการอัปเดตรายการยา - แสดงข้อมูลล่าสุดแล้ว';
        setTimeout(() => { liveMsg.value = ''; }, 5000);
        loadMedications();
      }
    )
    .subscribe();
}

export function stopRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

export async function updateMedicationDosage(id, newDosage) {
  const { data, error } = await supabase
    .from('medication_reminders')
    .update({ dosage: String(newDosage) })
    .eq('id', id)
    .select();

  if (error) return error.message;
  if (!data || data.length === 0) return 'ไม่มีสิทธิ์แก้ไข หรือไม่พบรายการยา';
  await loadMedications();
  return '';
}

export async function deleteMedication(id) {
  const { data, error } = await supabase
    .from('medication_reminders')
    .delete()
    .eq('id', id)
    .select();

  if (error) return error.message;
  if (!data || data.length === 0) return 'ไม่มีสิทธิ์ลบ หรือไม่พบรายการยา';
  await loadMedications();
  return '';
}

// Notification Functions
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
}

let notificationTimer = null;

export function startNotificationCheck() {
  requestNotificationPermission();

  if (notificationTimer) clearInterval(notificationTimer);

  notificationTimer = setInterval(() => {
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const todayStr = now.toISOString().substring(0, 10);

    medications.value.forEach((med) => {
      const rawTime = med.reminder_time || med.time || '';
      const medTime = rawTime ? rawTime.substring(0, 5) : '';
      
      if (medTime === currentTimeStr) {
        const alertKey = `${med.id}_${todayStr}_${currentTimeStr}`;
        
        // ถ้ากดยืนยันทานยาหรือปิดแจ้งเตือนรอบนี้ไปแล้ว จะข้ามทันที
        if (dismissedMedKeys.value.has(alertKey)) {
          return;
        }

        const medName = med.medication_name || med.title || med.name || 'ไม่ระบุชื่อยา';
        const medDose = med.dosage || med.dose || med.price || 0;
        
        // 1. เด้งกล่องแจ้งเตือน Banner บนหน้าเว็บ
        if (!activeAlerts.value.some(a => a.id === med.id)) {
          activeAlerts.value.push({ 
            ...med, 
            medication_name: medName,
            dosage: medDose,
            alertTime: currentTimeStr 
          });
          playAlertSound();
        }

        // 2. เด้ง Desktop Notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('⏰ ได้เวลาทานยาแล้ว!', {
            body: `ถึงเวลาทานยา: ${medName} (ขนาด ${medDose} มก.)`,
            icon: med.image_url || '/favicon.svg'
          });
        }
      }
    });
  }, 10000);
}

function playAlertSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = 587.33;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch (e) {
    console.log('Audio error:', e);
  }
}

export function dismissAlert(medId) {
  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;
  const todayStr = now.toISOString().substring(0, 10);

  const alertKey = `${medId}_${todayStr}_${currentTimeStr}`;
  dismissedMedKeys.value.add(alertKey);

  activeAlerts.value = activeAlerts.value.filter(a => a.id !== medId);
}