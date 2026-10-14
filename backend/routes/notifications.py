from flask import Blueprint, jsonify
from extensions import db
from models.notification import Notification
from utils.auth_middleware import get_current_user

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route('/notifications', methods=['GET'])
def get_user_notifications():
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    notifs = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(50).all()
    unread_count = Notification.query.filter_by(user_id=user.id, is_read=False).count()

    return jsonify({
        "success": True,
        "unread_count": unread_count,
        "data": [n.to_dict() for n in notifs]
    }), 200

@notifications_bp.route('/notifications/<int:notif_id>/read', methods=['POST'])
def mark_notification_read(notif_id):
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    notif = Notification.query.get(notif_id)
    if not notif or notif.user_id != user.id:
        return jsonify({"success": False, "message": "Notification not found"}), 404

    notif.is_read = True
    db.session.commit()

    return jsonify({"success": True, "message": "Notification marked as read"}), 200

@notifications_bp.route('/notifications/read-all', methods=['POST'])
def mark_all_notifications_read():
    user, employee, err_msg, status = get_current_user()
    if err_msg:
        return jsonify({"success": False, "message": err_msg}), status

    Notification.query.filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.session.commit()

    return jsonify({"success": True, "message": "All notifications marked as read"}), 200
