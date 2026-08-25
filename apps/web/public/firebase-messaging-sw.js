/* global importScripts, firebase */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({

  // Set these public Firebase Web App values before enabling push notifications.
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",

  authDomain: "dromocob-demo.firebaseapp.com",

  projectId: "dromocob-demo",

  messagingSenderId: "REPLACE_WITH_MESSAGING_SENDER_ID",

  appId: "REPLACE_WITH_FIREBASE_APP_ID",

});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "Dromocob";
  const body = payload?.notification?.body || "Yeni bildirimin var.";
  const image = payload?.notification?.image;
  const url = payload?.data?.url || "/";

  self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    image,
    data: { url },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
