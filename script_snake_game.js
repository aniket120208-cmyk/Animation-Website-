const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const gridSize = 20;
const tileCount = canvas.width / gridSize;
const appleImg = new Image();
appleImg.src = 'apple.png';
let score = 0;
let dx = gridSize;
let dy = 0;
let gameInterval;
let isGameOver = false;
let snake = [
    { x: 160, y: 200 },
    { x: 140, y: 200 },
    { x: 120, y: 200 }
];
let food = getRandomFoodPosition();
document.addEventListener('keydown', changeDirection);
function main() {
    if (isGameOver) return;
    setTimeout(function onTime() {
        clearCanvas();
        drawFood();
        moveSnake();
        drawSnake();
        checkCollision();
        main();
    }, 100); 
}
    main();
function clearCanvas() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function drawSnake() {
    snake.forEach((part, index) => {
        ctx.fillStyle = index === 0 ? '#8BC34A' : '#4CAF50';
        ctx.strokeStyle = '#1a1a1a';
        ctx.fillRect(part.x, part.y, gridSize, gridSize);
        ctx.strokeRect(part.x, part.y, gridSize, gridSize);
    });
}
function moveSnake() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    snake.unshift(head);
    const hasEatenFood = snake[0].x === food.x && snake[0].y === food.y;
    if (hasEatenFood) {
        score += 10;
        scoreElement.textContent = score;
        food = getRandomFoodPosition();
    } else {
        snake.pop(); 
    }
}
function getRandomFoodPosition() {
    let foodX, foodY;
    while (true) {
        foodX = Math.floor(Math.random() * tileCount) * gridSize;
        foodY = Math.floor(Math.random() * tileCount) * gridSize;
        let onSnake = snake.some(part => part.x === foodX && part.y === foodY);
        if (!onSnake) break;
    }
    return { x: foodX, y: foodY };
}
function drawFood() {
    ctx.drawImage(appleImg, food.x, food.y, gridSize, gridSize);
}
function changeDirection(event) {
    const keyPressed = event.keyCode;
    const LEFT_KEY = 37;
    const UP_KEY = 38;
    const RIGHT_KEY = 39;
    const DOWN_KEY = 40;
    const SPACE_KEY = 32;
    if (keyPressed === SPACE_KEY && isGameOver) {
        restartGame();
        return;
    }
    const goingUp = dy === -gridSize;
    const goingDown = dy === gridSize;
    const goingRight = dx === gridSize;
    const goingLeft = dx === -gridSize;
    if (keyPressed === LEFT_KEY && !goingRight) {
        dx = -gridSize;
        dy = 0;
    }
    if (keyPressed === UP_KEY && !goingDown) {
        dx = 0;
        dy = -gridSize;
    }
    if (keyPressed === RIGHT_KEY && !goingLeft) {
        dx = gridSize;
        dy = 0;
    }
    if (keyPressed === DOWN_KEY && !goingUp) {
        dx = 0;
        dy = gridSize;
    }
}
function checkCollision() {
    const hitLeftWall = snake[0].x < 0;
    const hitRightWall = snake[0].x >= canvas.width;
    const hitTopWall = snake[0].y < 0;
    const hitBottomWall = snake[0].y >= canvas.height;
    let hitSelf = false;
    for (let i = 4; i < snake.length; i++) {
        if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) {
          hitSelf = true;
          break;
        }
    }

    if (hitLeftWall || hitRightWall || hitTopWall || hitBottomWall || hitSelf) {
        isGameOver = true;
        drawGameOver();
    }
}
function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '30px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '16px Segoe UI';
    ctx.fillText('Press Space to Restart', canvas.width / 2, canvas.height / 2 + 30);
}
function restartGame() {
    score = 0;
    scoreElement.textContent = score;
    dx = gridSize;
    dy = 0;
    isGameOver = false;
    snake = [
        { x: 160, y: 200 },
        { x: 140, y: 200 },
        { x: 120, y: 200 }
    ];
    food = getRandomFoodPosition();
    main();
}