import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const NotificationContext = createContext({
  notificationsEnabled: true,
  setNotificationsEnabled: () => {},
  toggleNotifications: async () => {},
  sendNotification: () => {},
  toast: null,
  hideToast: () => {},
  permissionStatus: 'default'
});

export const NotificationProvider = ({ children }) => {
  const [notificationsEnabled, setNotificationsEnabledState] = useState(() => {
    try {
      const saved = localStorage.getItem('finovo_notifications');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch (e) {
      console.warn('Error reading notifications preference from localStorage', e);
    }
    return true;
  });

  const [permissionStatus, setPermissionStatus] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'granted';
  });

  const [toast, setToast] = useState(null);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    setToast({ message, type, duration, id: Date.now() });
  }, []);

  // Auto-hide toast after duration
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, toast.duration || 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const setNotificationsEnabled = useCallback((enabled) => {
    setNotificationsEnabledState(enabled);
    try {
      localStorage.setItem('finovo_notifications', enabled ? 'true' : 'false');
    } catch (e) {
      console.warn('Error saving notifications preference to localStorage', e);
    }
  }, []);

  const toggleNotifications = useCallback(async () => {
    if (!notificationsEnabled) {
      // User is turning notifications ON
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'denied') {
          showToast('Notification permission is required to receive alerts.', 'warning');
          setPermissionStatus('denied');
          return;
        }

        if (Notification.permission === 'default') {
          try {
            const permission = await Notification.requestPermission();
            setPermissionStatus(permission);
            if (permission !== 'granted') {
              showToast('Notification permission is required to receive alerts.', 'warning');
              setNotificationsEnabled(false);
              return;
            }
          } catch (err) {
            console.error('Error requesting notification permission:', err);
            showToast('Notification permission is required to receive alerts.', 'warning');
            return;
          }
        }
      }

      setNotificationsEnabled(true);
      showToast('Notifications Enabled.', 'success');
    } else {
      // User is turning notifications OFF
      setNotificationsEnabled(false);
      showToast('Notifications Disabled.', 'info');
    }
  }, [notificationsEnabled, setNotificationsEnabled, showToast]);

  const sendNotification = useCallback(({ title, message, type = 'info', action = null }) => {
    if (!notificationsEnabled) {
      // Strictly suppress all notifications when disabled
      return;
    }

    // Show in-app banner/toast
    setToast({
      title: title || 'Finovo Alert',
      message: message || '',
      type,
      action,
      id: Date.now()
    });

    // Also trigger native browser notification if granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title || 'Finovo', {
          body: message || '',
          icon: '/favicon.ico'
        });
      } catch {
        // Some browsers on mobile require service worker
      }
    }
  }, [notificationsEnabled]);

  return (
    <NotificationContext.Provider
      value={{
        notificationsEnabled,
        setNotificationsEnabled,
        toggleNotifications,
        sendNotification,
        toast,
        hideToast,
        showToast,
        permissionStatus
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
