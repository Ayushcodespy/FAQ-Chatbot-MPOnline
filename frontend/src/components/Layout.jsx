import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

function BellIcon() {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M15 18H5.5a1.5 1.5 0 0 1-1.2-2.4L6 13.4V10a6 6 0 1 1 12 0v3.4l1.7 2.2a1.5 1.5 0 0 1-1.2 2.4H15" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

function Layout({ children }) {
  const navigate = useNavigate();
  const { user, logout: clearSession } = useAuth();
  const [grievanceCount, setGrievanceCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("app_sidebar_collapsed") === "true";
  });

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  useEffect(() => {
    let isMounted = true;

    const loadGrievanceCount = async () => {
      if (!user) return;
      try {
        if (user.role === "admin" || user.role === "expert") {
          const { data } = await api.get("/grievances");
          if (isMounted) {
            setGrievanceCount(data.filter((item) => item.status !== "resolved").length);
          }
          return;
        }

        const { data } = await api.get("/grievances/mine");
        if (isMounted) {
          setGrievanceCount(data.length);
        }
      } catch {
        if (isMounted) {
          setGrievanceCount(0);
        }
      }
    };

    const loadNotifications = async () => {
      if (!user) return;
      try {
        const { data } = await api.get("/notifications");
        if (isMounted) {
          setNotifications(data);
        }
      } catch {
        if (isMounted) {
          setNotifications([]);
        }
      }
    };

    const refreshAll = () => {
      loadGrievanceCount();
      loadNotifications();
    };

    refreshAll();
    const intervalId = window.setInterval(refreshAll, 15000);
    window.addEventListener("grievance-change", refreshAll);
    window.addEventListener("notification-change", loadNotifications);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("grievance-change", refreshAll);
      window.removeEventListener("notification-change", loadNotifications);
    };
  }, [user]);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("app_sidebar_collapsed", String(next));
      return next;
    });
  };

  const openNotificationItem = async (item) => {
    try {
      if (!item.is_read) {
        await api.patch(`/notifications/${item.id}/read`);
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === item.id ? { ...notification, is_read: true } : notification
          )
        );
      }
      if (item.link) {
        navigate(item.link);
      }
      window.dispatchEvent(new Event("notification-change"));
    } catch {
      if (item.link) {
        navigate(item.link);
      }
    }
  };

  const markAllAsRead = async () => {
    await api.patch("/notifications/read-all");
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, is_read: true }))
    );
    window.dispatchEvent(new Event("notification-change"));
  };

  const markSelectedAsRead = async () => {
    if (selectedNotificationIds.length === 0) return;
    await api.patch("/notifications/read-selected", { ids: selectedNotificationIds });
    setNotifications((current) =>
      current.map((notification) =>
        selectedNotificationIds.includes(notification.id)
          ? { ...notification, is_read: true }
          : notification
      )
    );
    setSelectedNotificationIds([]);
    setSelectionMode(false);
    window.dispatchEvent(new Event("notification-change"));
  };

  const deleteSelected = async () => {
    if (selectedNotificationIds.length === 0) return;
    await api.delete("/notifications", { data: { ids: selectedNotificationIds } });
    setNotifications((current) =>
      current.filter((notification) => !selectedNotificationIds.includes(notification.id))
    );
    setSelectedNotificationIds([]);
    setSelectionMode(false);
    window.dispatchEvent(new Event("notification-change"));
  };

  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <AppSidebar
        collapsed={sidebarCollapsed}
        grievanceCount={grievanceCount}
        onToggleCollapse={toggleSidebar}
        user={user}
      />

      <header className="app-topbar">
        <div className="app-brand">
          <p className="eyebrow">MPOnline</p>
          <h1>FAQ Assistant</h1>
        </div>

        <div className="topbar-actions">
          <div className="notification-wrap">
            <button
              className="notification-trigger"
              onClick={() => setNotificationOpen((current) => !current)}
              type="button"
              aria-label="Open notifications"
            >
              <BellIcon />
              {unreadCount > 0 && <span className="topbar-count-badge">{unreadCount}</span>}
            </button>

            {notificationOpen && (
              <div className="notification-dropdown">
                <div className="notification-topbar">
                  <strong>Notifications</strong>
                  <div className="notification-topbar-actions">
                    <button
                      className="text-action-button"
                      onClick={() => {
                        setSelectionMode((current) => !current);
                        setSelectedNotificationIds([]);
                      }}
                      type="button"
                    >
                      {selectionMode ? "Cancel" : "Select"}
                    </button>
                    <button className="text-action-button" onClick={markAllAsRead} type="button">
                      Mark all as read
                    </button>
                  </div>
                </div>

                {selectionMode && (
                  <div className="notification-selection-bar">
                    <button className="text-action-button" onClick={markSelectedAsRead} type="button">
                      Mark selected
                    </button>
                    <button className="text-action-button danger" onClick={deleteSelected} type="button">
                      Delete selected
                    </button>
                  </div>
                )}

                <div className="notification-list">
                  {notifications.length === 0 && (
                    <div className="empty-comment-state">
                      <small>No notifications yet.</small>
                    </div>
                  )}

                  {notifications.map((item) => (
                    <div
                      className={item.is_read ? "notification-item" : "notification-item unread"}
                      key={item.id}
                    >
                      {selectionMode && (
                        <input
                          checked={selectedNotificationIds.includes(item.id)}
                          onChange={(event) =>
                            setSelectedNotificationIds((current) =>
                              event.target.checked
                                ? [...current, item.id]
                                : current.filter((value) => value !== item.id)
                            )
                          }
                          type="checkbox"
                        />
                      )}
                      <button
                        className="notification-item-button"
                        disabled={selectionMode}
                        onClick={() => openNotificationItem(item)}
                        type="button"
                      >
                        <div className="notification-item-head">
                          <strong>{item.title}</strong>
                          <small>{new Date(item.created_at).toLocaleString()}</small>
                        </div>
                        <p>{item.body}</p>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="profile-menu-wrap">
            <button
              className="profile-trigger"
              onClick={() => setProfileOpen((current) => !current)}
              type="button"
            >
              <span className="profile-avatar">{user?.username?.slice(0, 1)?.toUpperCase() || "U"}</span>
              <span className="profile-meta">
                <strong>{user?.username}</strong>
                <small>{user?.role}</small>
              </span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <p><strong>{user?.username}</strong></p>
                <p className="muted">{user?.email}</p>
                <p className="muted">Role: {user?.role}</p>
                <p className="muted">Unread notifications: {unreadCount}</p>
                <button className="secondary-button" onClick={logout} type="button">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="content content-no-sidebar">
        {children}
      </main>
    </div>
  );
}

export default Layout;
