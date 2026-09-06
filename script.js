function startGame(gameName) {
    const playerName = document.getElementById('playerName').value.trim();
    if (playerName === "") {
      alert("ACCESS DENIED: Please enter your name to play.");
      document.getElementById('playerName').focus(); 
    } else {
       localStorage.setItem('currentPlayer', playerName);
       if(gameName==="Snake Game"){
        window.location.href = "snake_game.html";
       }
       else if(gameName==="Dont Look"){
        window.location.href = "dont_look.html";
       }
      }
  }
