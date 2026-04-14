importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

// This will be replaced by the actual config during build or served dynamically
// For now, we'll assume the client will pass the config or we'll fetch it
// Actually, the simplest way is to have the client register the SW with the config

firebase.initializeApp({
  apiKey: "REPLACED_BY_CLIENT",
  authDomain: "REPLACED_BY_CLIENT",
  projectId: "REPLACED_BY_CLIENT",
  storageBucket: "REPLACED_BY_CLIENT",
  messagingSenderId: "REPLACED_BY_CLIENT",
  appId: "REPLACED_BY_CLIENT"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png' // Adjust as needed
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
