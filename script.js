function startGame(gameName) {
    const playerName = document.getElementById('playerName').value.trim();
    if (playerName === "") {
      alert("ACCESS DENIED: Please enter your name to play.");
      document.getElementById('playerName').focus(); 
    } else {
      alert("Welcome " + playerName + "! Launching " + gameName + "...");
      }
  }
