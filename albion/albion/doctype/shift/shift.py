import frappe
from frappe.model.document import Document
from datetime import datetime, timedelta

class Shift(Document):
    def validate(self):
        self.calculate_duration()
    
    def calculate_duration(self):
        if self.start_time and self.end_time:
            start = datetime.strptime(str(self.start_time), "%H:%M:%S")
            end = datetime.strptime(str(self.end_time), "%H:%M:%S")
            
            if end < start:
                end += timedelta(days=1)
            
            diff = end - start
            self.duration_minutes = int(diff.total_seconds() / 60)