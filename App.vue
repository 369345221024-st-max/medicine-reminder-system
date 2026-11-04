<template>
  <div class="app-container">
    <!-- แถบเมนูนำทางแบบกล่องการ์ด (Navbar Cards) -->
    <header class="app-header">
      <nav aria-label="เมนูหลัก" class="nav-container">
        <router-link to="/" class="nav-card">
          <span class="nav-icon">🏠</span>
          <span class="nav-text">หน้าแรก</span>
        </router-link>

        <router-link to="/medications" class="nav-card">
          <span class="nav-icon">💊</span>
          <span class="nav-text">รายการยา</span>
        </router-link>

        <router-link to="/summary" class="nav-card">
          <span class="nav-icon">📋</span>
          <span class="nav-text">สรุปการทานยา</span>
          <span class="badge" v-if="itemCount > 0">{{ itemCount }}</span>
        </router-link>

        <!-- 🚫 ซ่อนเมนูหน้าผลลัพธ์ (Impact) ด้วยคอมเมนต์แบบสะอาด -->
        <!--
        <router-link v-if="user" to="/impact" class="nav-card">
          <span class="nav-icon">📊</span>
          <span class="nav-text">ผลลัพธ์ (Impact)</span>
        </router-link>
        -->

        <!-- แสดงเฉพาะเมื่อล็อกอินแล้ว -->
        <router-link v-if="user" to="/admin" class="nav-card nav-card-admin">
          <span class="nav-icon">⚙️</span>
          <span class="nav-text">หลังบ้าน</span>
        </router-link>

        <!-- ส่วนของสถานะล็อกอิน -->
        <div class="user-status-card">
          <template v-if="!user">
            <router-link to="/login" class="btn-login">
              🔑 เข้าสู่ระบบ
            </router-link>
          </template>
          <template v-else>
            <div class="user-profile">
              <span class="user-email" :title="user.email">👤 {{ user.email }}</span>
              <button @click="logout" class="btn-logout">ออกจากระบบ</button>
            </div>
          </template>
        </div>
      </nav>
    </header>

    <!-- 🚨 กล่องแจ้งเตือนด่วนเมื่อถึงเวลาทานยา -->
    <div v-if="activeAlerts && activeAlerts.length > 0" class="alert-banner" role="alert">
      <div v-for="alert in activeAlerts" :key="alert.id" class="alert-card">
        <div class="alert-content">
          <span class="alert-icon">⏰</span>
          <div>
            <strong>ถึงเวลาทานยาแล้ว! ({{ alert.alertTime }} น.)</strong>
            <p>{{ alert.medication_name || alert.title }} - ขนาด {{ alert.dosage }} มก.</p>
          </div>
        </div>
        <div class="alert-btns">
          <button @click="handleTakeAndDismiss(alert)" class="btn-take-now">✅ กดทานยาเลย</button>
          <button @click="dismissAlert(alert.id)" class="btn-dismiss">ปิดเตือน</button>
        </div>
      </div>
    </div>

    <!-- ข้อความแจ้งเตือน Realtime -->
    <p v-if="liveMsg" class="live-toast" role="status" aria-live="polite">
      🔔 {{ liveMsg }}
    </p>

    <!-- เนื้อหาหลักของแต่ละหน้า -->
    <main id="main" class="main-content" tabindex="-1">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  itemCount,
  loadMedications,
  liveMsg,
  startRealtime,
  stopRealtime,
  user,
  signOut,
  activeAlerts,
  startNotificationCheck,
  dismissAlert,
  takeMedicine
} from './store.js';

const router = useRouter();

async function logout() {
  await signOut();
  router.push('/');
}

function handleTakeAndDismiss(alert) {
  takeMedicine(alert);
  dismissAlert(alert.id);
  router.push('/summary');
}

onMounted(() => {
  loadMedications();
  startRealtime();
  if (typeof startNotificationCheck === 'function') {
    startNotificationCheck();
  }
});

onUnmounted(stopRealtime);
</script>

<style>
/* Reset & Layout หลัก */
.app-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 16px;
  font-family: 'Sarabun', system-ui, -apple-system, sans-serif;
  color: #2c3e50;
}

.app-header {
  margin-bottom: 24px;
}

/* Container ของ Navbar */
.nav-container {
  display: flex !important;
  gap: 12px !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  background-color: #f8fafc !important;
  padding: 12px 16px !important;
  border-radius: 16px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
  border: 1px solid #e2e8f0 !important;
}

/* ปุ่มกล่องการ์ดแต่ละเมนู */
.nav-card {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 10px 18px !important;
  background-color: #ffffff !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  color: #475569 !important;
  font-weight: 600 !important;
  font-size: 15px !important;
  transition: all 0.2s ease-in-out !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02) !important;
}

.nav-card:hover {
  background-color: #f1f5f9 !important;
  border-color: #0E8C7B !important;
  color: #0E8C7B !important;
  transform: translateY(-2px) !important;
}

/* ไฮไลท์เมนูหน้าที่เปิดอยู่ */
.nav-card.router-link-exact-active {
  background-color: #0E8C7B !important;
  color: #ffffff !important;
  border-color: #0E8C7B !important;
  box-shadow: 0 4px 10px rgba(14, 140, 123, 0.3) !important;
}

.nav-icon {
  font-size: 18px !important;
}

/* Badge แสดงจำนวน */
.badge {
  background-color: #ef4444 !important;
  color: #ffffff !important;
  font-size: 12px !important;
  font-weight: bold !important;
  padding: 2px 7px !important;
  border-radius: 10px !important;
  margin-left: 4px !important;
}

.nav-card.router-link-exact-active .badge {
  background-color: #ffffff !important;
  color: #0E8C7B !important;
}

/* ส่วนล็อกอิน / ออกจากระบบ ด้านขวา */
.user-status-card {
  margin-left: auto !important;
}

.btn-login {
  display: inline-block !important;
  padding: 10px 18px !important;
  background-color: #0E8C7B !important;
  color: #ffffff !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: bold !important;
  font-size: 14px !important;
}

.user-profile {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  background-color: #ffffff !important;
  padding: 6px 12px !important;
  border-radius: 12px !important;
  border: 1px solid #cbd5e1 !important;
}

.user-email {
  font-size: 13px !important;
  color: #334155 !important;
  max-width: 180px !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

.btn-logout {
  padding: 6px 12px !important;
  background-color: #fee2e2 !important;
  color: #dc2626 !important;
  border: 1px solid #fca5a5 !important;
  border-radius: 8px !important;
  font-size: 13px !important;
  font-weight: bold !important;
  cursor: pointer !important;
}

/* Notification & Toast */
.live-toast {
  background-color: #e6f4f1 !important;
  color: #0E8C7B !important;
  padding: 10px 16px !important;
  border-radius: 10px !important;
  font-weight: bold !important;
  margin-bottom: 16px !important;
  border: 1px solid #b4e3db !important;
}

.alert-banner {
  background-color: #fef2f2 !important;
  border: 2px solid #ef4444 !important;
  border-radius: 14px !important;
  padding: 16px !important;
  margin-bottom: 20px !important;
}

.alert-card {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  gap: 16px !important;
}

.alert-content {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  color: #991b1b !important;
}

.alert-icon { font-size: 28px !important; }

.btn-take-now {
  background-color: #16a34a !important;
  color: white !important;
  border: none !important;
  padding: 8px 16px !important;
  border-radius: 8px !important;
  font-weight: bold !important;
  cursor: pointer !important;
}

.btn-dismiss {
  background-color: #9ca3af !important;
  color: white !important;
  border: none !important;
  padding: 8px 12px !important;
  border-radius: 8px !important;
  cursor: pointer !important;
}
</style>