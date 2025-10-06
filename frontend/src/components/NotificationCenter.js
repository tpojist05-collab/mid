import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../App';
import { toast } from 'sonner';

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Auto-refresh notifications every 30 seconds when panel is open
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/notifications');
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiClient.patch(`/notifications/${notificationId}/read`);
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true }
            : notif
        )
      );
      toast.success('Notification marked as read');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.patch('/notifications/mark-all-read');
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const clearAllNotifications = async () => {
    if (!window.confirm('Are you sure you want to clear all notifications? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient.delete('/notifications/clear-all');
      setNotifications([]);
      toast.success('All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info':
      default: return 'ℹ️';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'info':
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short'
    });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="relative"
          data-testid="notification-bell"
        >
          🔔
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs bg-red-500 text-white border-0"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🔔 Notifications
            {unreadCount > 0 && (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                {unreadCount} unread
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="spinner"></div>
              <span className="ml-3 text-slate-600">Loading notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🔔</div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">
                No notifications yet
              </h3>
              <p className="text-slate-600">
                You'll see system updates and important information here.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={`border transition-all duration-200 ${
                  notification.read 
                    ? 'bg-white/50' 
                    : 'bg-white shadow-md border-l-4 border-l-blue-500'
                }`}
                data-testid={`notification-${notification.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">
                          {getNotificationIcon(notification.type)}
                        </span>
                        <h4 className={`font-medium ${notification.read ? 'text-slate-600' : 'text-slate-800'}`}>
                          {notification.title}
                        </h4>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getNotificationColor(notification.type)}`}
                        >
                          {notification.type}
                        </Badge>
                      </div>
                      
                      <p className={`text-sm ${notification.read ? 'text-slate-500' : 'text-slate-700'}`}>
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-slate-500">
                          {formatDate(notification.created_at)}
                        </span>
                        
                        {!notification.read && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs h-6 px-2"
                            data-testid={`mark-read-${notification.id}`}
                          >
                            Mark as read
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <span className="text-sm text-slate-600">
            {notifications.length} total notifications
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationCenter;