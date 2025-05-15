<script>
  // Sample locations order for simulation (should come from backend in real use)
  const route = [
    { name: "ISBT", timeToNext: 10 },   // time in minutes
    { name: "Rajpur Road", timeToNext: 8 },
    { name: "Clock Tower", timeToNext: 7 },
    { name: "Prem Nagar", timeToNext: 0 } // destination
  ];

  let currentIndex = 0;
  let elapsed = 0;
  let totalTime = route.reduce((sum, loc) => sum + loc.timeToNext, 0);

  const statusDiv = document.getElementById("delivery-status");

  function updateDeliveryStatus() {
    if (currentIndex >= route.length - 1) {
      statusDiv.textContent = "🎉 Package delivered at " + route[currentIndex].name + "!";
      clearInterval(simulationInterval);
      return;
    }

    const currentLocation = route[currentIndex].name;
    const nextLocation = route[currentIndex + 1].name;
    const timeToNext = route[currentIndex].timeToNext;

    statusDiv.textContent = `Current Location: ${currentLocation} ➡ Next: ${nextLocation} | Time to next: ${timeToNext} mins | Elapsed: ${elapsed} mins | Remaining: ${totalTime - elapsed} mins`;

    // Move forward every 5 simulated minutes (5 seconds real-time)
    elapsed += 5;
    if (elapsed >= timeToNext) {
      elapsed = 0;
      currentIndex++;
    }
  }

  // Start simulation every 5 seconds (simulate 5 mins per update)
  const simulationInterval = setInterval(updateDeliveryStatus, 5000);

  // Initialize display
  updateDeliveryStatus();
</script>
