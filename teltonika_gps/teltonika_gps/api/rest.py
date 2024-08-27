import frappe

@frappe.whitelist()
def get_latest_gps_logs():
    return frappe.db.sql("""
        SELECT t1.*
        FROM `tabGPS Logs` t1
        INNER JOIN (
            SELECT device_id, MAX(STR_TO_DATE(recieved_at, '%d/%m/%Y %H:%i')) as MaxDateTime
            FROM `tabGPS Logs`
            GROUP BY device_id
        ) t2
        ON t1.device_id = t2.device_id
        AND STR_TO_DATE(t1.recieved_at, '%d/%m/%Y %H:%i') = t2.MaxDateTime
    """, as_dict=True)
