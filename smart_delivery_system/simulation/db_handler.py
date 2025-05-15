import csv

def load_locations(csv_path):
    with open(csv_path, newline='') as f:
        reader = csv.DictReader(f)
        return list(reader)

def get_location_index(locations, name):
    for i, loc in enumerate(locations):
        if loc['name'].lower() == name.lower():
            return i
    return -1