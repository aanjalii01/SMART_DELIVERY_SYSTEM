import time

def simulate_delivery(order, route, delay_callback, finish_callback):
    total_steps = len(route)
    for i, point in enumerate(route):
        time.sleep(2)  # simulate time delay
        delay_callback(i + 1, total_steps, point)
    finish_callback()