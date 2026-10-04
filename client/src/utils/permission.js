export const canAccess = (role, action) => {
  const permissions = {
    'admin_master': ['view_dashboard', 'manage_users', 'edit_event', 'delete_event', 'view_profile'],
    'admin_support': ['create_event', 'edit_event', 'delete_event', 'view_profile'],
    'user_vip': ['view_event', 'buy_ticket', 'comment', 'rate', 'view_profile', 'smart_itinerary', 'ai_chatbot'],
    'user': ['view_event', 'buy_ticket', 'comment', 'rate', 'view_profile']
  };
  return permissions[role]?.includes(action) || false;
};
