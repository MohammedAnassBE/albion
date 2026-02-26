import frappe
from frappe.model.document import Document
from datetime import datetime, timedelta

class Shift(Document):
    def validate(self):
        self.calculate_duration()
    
    def calculate_duration(self):
        if self.start_time and self.end_time:
            start_str = str(self.start_time)
            end_str = str(self.end_time)

            # Normalize HH:MM to HH:MM:SS
            if start_str.count(':') == 1:
                start_str += ':00'
            if end_str.count(':') == 1:
                end_str += ':00'

            start = datetime.strptime(start_str, "%H:%M:%S")
            end = datetime.strptime(end_str, "%H:%M:%S")
            
            if end < start:
                end += timedelta(days=1)
            
            diff = end - start
            self.duration_minutes = int(diff.total_seconds() / 60)