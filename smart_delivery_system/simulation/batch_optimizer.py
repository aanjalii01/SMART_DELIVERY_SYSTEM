def sort_by_priority(orders):
    priority_map = {'emergency': 1, 'medical': 2, 'normal': 3}
    return sorted(orders, key=lambda o: priority_map[o['type']])