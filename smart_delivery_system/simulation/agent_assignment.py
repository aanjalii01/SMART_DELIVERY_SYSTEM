import random

def assign_drone(drones, source):
    available_drones = [d for d in drones if d['status'] == 'available']
    if not available_drones:
        return None
    return min(available_drones, key=lambda d: abs(d['location_index'] - source))