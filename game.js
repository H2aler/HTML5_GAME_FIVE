// 캔버스 설정
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1200;  // 캔버스 너비 설정
canvas.height = 800;  // 캔버스 높이 설정

// 게임 상태
const gameState = {
    money: 0,
    stage: 1,
    kills: 0,
    requiredKills: 20,
    isPaused: true,  // 시작 시 일시정지 상태
    isGameOver: false,
    isMenuOpen: false,
    groundY: canvas.height - 150,
    backgroundOffset: 0,
    speed: 0,
    maxSpeed: 10,
    difficulty: null,  // 초기 난이도 null로 설정
    isGameStarted: false  // 게임 시작 여부
};

// 난이도별 설정
const difficultySettings = {
    easy: {
        spawnRate: 0.015,  // 유지
        missileSpeed: 3,
        missileDamage: 10,
        missileHealth: 50,
        rewardMultiplier: 1
    },
    normal: {
        spawnRate: 0.05,  // 미사일 생성 빈도 감소 (0.12 -> 0.05)
        missileSpeed: 5,
        missileDamage: 15,
        missileHealth: 75,
        rewardMultiplier: 1.5
    },
    hard: {
        spawnRate: 0.15,  // 유지
        missileSpeed: 7,
        missileDamage: 20,
        missileHealth: 100,
        rewardMultiplier: 2
    }
};

// 배경 요소
const mountains = [];
for (let i = 0; i < 8; i++) {  // 더 많은 산을 생성
    mountains.push({
        x: i * 300,  // 간격을 조정
        height: 150 + Math.random() * 200  // 랜덤한 높이
    });
}

// 무기 정보
const weapons = {
    machineGun: {
        name: '기관총',
        damage: 10,
        fireRate: 150,
        spread: 3,
        unlocked: true,
        lastFired: 0
    },
    shotgun: {
        name: '샷건',
        damage: 15,
        fireRate: 500,
        spread: 20,
        pellets: 5,
        unlocked: false,
        cost: 500,
        lastFired: 0
    },
    rocket: {
        name: '로켓 런처',
        damage: 50,
        fireRate: 1000,
        radius: 100,
        unlocked: false,
        cost: 1000,
        lastFired: 0
    }
};

// 플레이어 설정
const player = {
    x: 150,  // 왼쪽에 고정
    y: canvas.height - 400,  // 높은 위치에서 시작
    width: 50,  // 비행기 크기 축소
    height: 25,  // 비행기 크기 축소
    speed: 5,
    health: 100,
    maxHealth: 100,
    currentWeapon: 'machineGun',
    engineLevel: 1,
    armorLevel: 1
};

// 게임 객체들
let bullets = [];
let zombies = [];
let explosions = [];
let particles = [];

// 키보드 입력 처리
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

// 모바일 컨트롤 설정
const mobileControls = {
    up: false,
    down: false,
    left: false,
    right: false,
    shoot: false
};

// 조이스틱 컨트롤 설정
const joystickState = {
    active: false,
    centerX: 0,
    centerY: 0,
    knobX: 0,
    knobY: 0,
    maxDistance: 50
};

// 메뉴 토글
function toggleMenu() {
    gameState.isMenuOpen = !gameState.isMenuOpen;
    gameState.isPaused = gameState.isMenuOpen;
    document.getElementById('menu').style.display = gameState.isMenuOpen ? 'block' : 'none';
}

// 업그레이드 처리
function upgrade(type) {
    const costs = {
        engine: 100 * player[type + 'Level'],
        armor: 150 * player[type + 'Level']
    };

    if (gameState.money >= costs[type]) {
        gameState.money -= costs[type];
        player[type + 'Level']++;
        
        if (type === 'engine') {
            player.speed += 1;
        } else if (type === 'armor') {
            player.maxHealth += 20;
            player.health = player.maxHealth;
        }
        
        updateUI();
    }
}

// 무기 선택
function selectWeapon(weapon) {
    if (weapons[weapon].unlocked) {
        player.currentWeapon = weapon;
        updateWeaponUI();
    } else if (gameState.money >= weapons[weapon].cost) {
        gameState.money -= weapons[weapon].cost;
        weapons[weapon].unlocked = true;
        player.currentWeapon = weapon;
        updateWeaponUI();
        updateUI();
    }
}

// UI 업데이트
function updateUI() {
    document.getElementById('money').textContent = gameState.money;
    document.getElementById('health').textContent = player.health;
    document.getElementById('maxHealth').textContent = player.maxHealth;
    document.getElementById('stage').textContent = gameState.stage;
    document.getElementById('kills').textContent = gameState.kills;
    document.getElementById('required-kills').textContent = gameState.requiredKills;
    document.getElementById('engine-level').textContent = player.engineLevel;
    document.getElementById('armor-level').textContent = player.armorLevel;
}

function updateWeaponUI() {
    document.querySelectorAll('.weapon-item').forEach(item => {
        item.classList.remove('selected-weapon');
    });
    document.getElementById('weapon-' + player.currentWeapon).classList.add('selected-weapon');
}

// 오디오 효과음 설정
const sounds = {
    shoot: new Audio('sounds/laser.mp3'),  // 레이저 발사음
    explosion: new Audio('sounds/explosion.mp3'),  // 폭발음
    playerCrash: new Audio('sounds/crash.mp3'),  // 충돌음
    bgm: new Audio('sounds/bgm.mp3')  // 배경음악
};

// 효과음 볼륨 설정
Object.values(sounds).forEach(sound => {
    if (sound === sounds.bgm) {
        sound.volume = 0.4;  // 배경음악 볼륨
        sound.loop = true;   // 배경음악 반복 재생
    } else if (sound === sounds.shoot) {
        sound.volume = 0.3;  // 발사음 볼륨
    } else if (sound === sounds.explosion) {
        sound.volume = 1.0;  // 폭발음 볼륨
    } else {
        sound.volume = 0.5;  // 기타 효과음 볼륨
    }
});

// 효과음 재생 함수
function playSound(soundName) {
    try {
        const sound = sounds[soundName];
        if (sound) {
            if (soundName === 'bgm') {
                // 배경음악 재생
                if (sound.paused) {
                    sound.play().catch(error => {
                        console.error('배경음악 재생 실패:', error);
                    });
                }
            } else {
                // 효과음 재생
                const clone = sound.cloneNode();
                clone.volume = sound.volume;
                clone.play().catch(error => {
                    console.error('효과음 재생 실패:', error);
                });
            }
        }
    } catch (error) {
        console.error('효과음 재생 중 오류:', error);
    }
}

// 효과음 테스트 함수
function testSounds() {
    console.log('사운드 테스트 시작');
    
    // 각 효과음 순차적으로 테스트
    const soundNames = Object.keys(sounds);
    let currentIndex = 0;
    
    function playNextSound() {
        if (currentIndex < soundNames.length) {
            const soundName = soundNames[currentIndex];
            console.log(`${soundName} 재생 시도...`);
            
            const sound = sounds[soundName];
            sound.volume = 0.5;  // 볼륨 50%로 설정
            
            sound.play()
                .then(() => {
                    console.log(`${soundName} 재생 성공`);
                    currentIndex++;
                    setTimeout(playNextSound, 1000);  // 1초 후 다음 사운드 재생
                })
                .catch(error => {
                    console.error(`${soundName} 재생 실패:`, error);
                    currentIndex++;
                    setTimeout(playNextSound, 1000);
                });
        }
    }
    
    playNextSound();
}

// 게임 시작 시 오디오 초기화
function initializeAudio() {
    // 모든 사운드 미리 로드
    Object.values(sounds).forEach(sound => {
        sound.load();
    });

    // 사용자 상호작용 필요
    const startButton = document.createElement('button');
    startButton.textContent = '게임 시작 (소리 켜기)';
    startButton.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px;
        font-size: 20px;
        background: #ff4500;
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        z-index: 1000;
        font-family: 'Arial', sans-serif;
    `;
    
    startButton.onclick = function() {
        // 배경음악 시작
        playSound('bgm');
        // 버튼 제거
        startButton.remove();
    };
    
    document.body.appendChild(startButton);
}

// 게임 시작 시 오디오 초기화 실행
window.addEventListener('load', () => {
    setupMobileControls();
    initializeAudio();
    initJoystick();
});

// 총알 생성
function createBullet() {
    const weapon = weapons[player.currentWeapon];
    const now = Date.now();
    
    if (now - weapon.lastFired >= weapon.fireRate) {
        weapon.lastFired = now;
        
        // 발사 효과음 재생
        playSound('shoot');
        
        if (player.currentWeapon === 'shotgun') {
            for (let i = 0; i < weapon.pellets; i++) {
                const spread = (Math.random() - 0.5) * weapon.spread;
                bullets.push({
                    x: player.x + player.width,
                    y: player.y + player.height/2,
                    speed: 10,
                    damage: weapon.damage,
                    angle: spread,
                    type: 'shotgun'
                });
            }
        } else if (player.currentWeapon === 'rocket') {
            bullets.push({
                x: player.x + player.width,
                y: player.y + player.height/2,
                speed: 7,
                damage: weapon.damage,
                radius: weapon.radius,
                type: 'rocket'
            });
        } else {
            const spread = (Math.random() - 0.5) * weapon.spread;
            bullets.push({
                x: player.x + player.width,
                y: player.y + player.height/2,
                speed: 12,
                damage: weapon.damage,
                angle: spread,
                type: 'machineGun'
            });
        }
    }
}

// 파티클 생성
function createParticles(x, y, color, count, speed = 5) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * speed,
            vy: (Math.random() - 0.5) * speed,
            life: 30,
            color: color
        });
    }
}

// 배경 그리기
function drawBackground() {
    // 하늘 (붉은 톤)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, gameState.groundY);
    skyGradient.addColorStop(0, '#4b0082');  // 어두운 보라
    skyGradient.addColorStop(0.5, '#8b0000');  // 어두운 빨강
    skyGradient.addColorStop(1, '#ff4500');  // 붉은 주황
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, gameState.groundY);

    // 산 그리기
    ctx.fillStyle = '#2c1810';  // 어두운 갈색
    mountains.forEach(mountain => {
        let mountainX = (mountain.x - gameState.backgroundOffset) % (canvas.width + 600);
        // 화면 왼쪽 끝을 넘어갔을 때 오른쪽 끝으로 이동
        if (mountainX < -200) {
            mountainX += canvas.width + 600;
        }
        
        ctx.beginPath();
        ctx.moveTo(mountainX, gameState.groundY);
        ctx.lineTo(mountainX + 100, gameState.groundY - mountain.height);
        ctx.lineTo(mountainX + 200, gameState.groundY);
        ctx.fill();
    });

    // 지면
    ctx.fillStyle = '#1a0f0f';  // 어두운 갈색
    ctx.fillRect(0, gameState.groundY, canvas.width, canvas.height - gameState.groundY);
}

// 비행기 그리기
function drawPlane(x, y, width, height) {
    ctx.save();  // 현재 컨텍스트 상태 저장
    
    // 기체 본체
    ctx.fillStyle = '#4682b4';  // 스틸블루
    ctx.beginPath();
    ctx.moveTo(x + width * 0.2, y + height * 0.5);
    ctx.lineTo(x + width * 0.8, y + height * 0.5);
    ctx.lineTo(x + width, y + height * 0.3);
    ctx.lineTo(x + width * 0.8, y + height * 0.1);
    ctx.lineTo(x + width * 0.2, y + height * 0.1);
    ctx.lineTo(x, y + height * 0.3);
    ctx.closePath();
    ctx.fill();

    // 날개
    ctx.fillStyle = '#36648b';  // 더 어두운 블루
    ctx.beginPath();
    ctx.moveTo(x + width * 0.3, y + height * 0.4);
    ctx.lineTo(x + width * 0.5, y + height);
    ctx.lineTo(x + width * 0.6, y + height);
    ctx.lineTo(x + width * 0.4, y + height * 0.4);
    ctx.closePath();
    ctx.fill();

    // 꼬리 날개
    ctx.beginPath();
    ctx.moveTo(x + width * 0.7, y);
    ctx.lineTo(x + width * 0.8, y - height * 0.3);
    ctx.lineTo(x + width * 0.9, y);
    ctx.closePath();
    ctx.fill();

    // 창문
    ctx.fillStyle = '#1c1c1c';
    for(let i = 0; i < 2; i++) {  // 창문 개수 2개로 감소
        ctx.beginPath();
        ctx.arc(x + width * (0.3 + i * 0.3), y + height * 0.3, height * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    // 프로펠러 효과
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;  // 선 두께 감소
    for(let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + height * 0.3);
        ctx.lineTo(x - 15, y + height * (0.1 + i * 0.2));  // 프로펠러 길이 감소
        ctx.stroke();
    }

    ctx.restore();  // 컨텍스트 상태 복원
}

// 계기판 그리기
function drawDashboard() {
    const dashY = canvas.height - 100;
    
    // 속도계
    ctx.beginPath();
    ctx.arc(canvas.width/2, dashY + 50, 40, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 5;
    ctx.stroke();
    
    // 속도 표시
    const speedAngle = (gameState.speed / gameState.maxSpeed) * Math.PI + Math.PI;
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, dashY + 50);
    ctx.lineTo(
        canvas.width/2 + Math.cos(speedAngle) * 35,
        dashY + 50 + Math.sin(speedAngle) * 35
    );
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.stroke();
}

// 미사일 적 그리기
function drawZombie(missile) {
    ctx.save();
    
    // 미사일 중심점으로 이동
    ctx.translate(missile.x + missile.width/2, missile.y + missile.height/2);
    
    // 미사일 각도로 회전
    ctx.rotate(missile.angle);
    
    // 미사일 본체
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(missile.width/2, 0);
    ctx.lineTo(-missile.width/2, -missile.height/2);
    ctx.lineTo(-missile.width/3, 0);
    ctx.lineTo(-missile.width/2, missile.height/2);
    ctx.closePath();
    ctx.fill();

    // 날개
    ctx.fillStyle = '#e74c3c';
    // 위쪽 날개
    ctx.beginPath();
    ctx.moveTo(-missile.width/4, -missile.height/4);
    ctx.lineTo(-missile.width/2, -missile.height);
    ctx.lineTo(0, -missile.height/4);
    ctx.closePath();
    ctx.fill();
    
    // 아래쪽 날개
    ctx.beginPath();
    ctx.moveTo(-missile.width/4, missile.height/4);
    ctx.lineTo(-missile.width/2, missile.height);
    ctx.lineTo(0, missile.height/4);
    ctx.closePath();
    ctx.fill();

    // 엔진 불꽃 효과
    const gradient = ctx.createLinearGradient(-missile.width/2, 0, -missile.width, 0);
    gradient.addColorStop(0, 'rgba(255, 69, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
    ctx.fillStyle = gradient;
    
    ctx.beginPath();
    ctx.moveTo(-missile.width/2, -missile.height/3);
    ctx.lineTo(-missile.width, 0);
    ctx.lineTo(-missile.width/2, missile.height/3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // 체력바
    const settings = difficultySettings[gameState.difficulty];
    const healthPercent = missile.health / settings.missileHealth;
    const healthBarWidth = missile.width;
    const healthBarHeight = 5;
    const healthBarY = missile.y - 10;

    // 체력바 배경
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(missile.x, healthBarY, healthBarWidth, healthBarHeight);

    // 현재 체력
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(missile.x, healthBarY, healthBarWidth * healthPercent, healthBarHeight);
}

// 게임 시작 화면 그리기
function drawStartScreen() {
    // 배경
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#4b0082');
    gradient.addColorStop(0.5, '#8b0000');
    gradient.addColorStop(1, '#ff4500');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 제목
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('미사일 크러쉬 서바이벌', canvas.width/2, canvas.height/3);

    // 난이도 선택 안내
    if (!gameState.difficulty) {
        ctx.font = '24px Arial';
        ctx.fillText('난이도를 선택하여 게임을 시작하세요', canvas.width/2, canvas.height/2);

        // 난이도 설명
        ctx.font = '18px Arial';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('쉬움: 느린 미사일, 적은 데미지', canvas.width/2, canvas.height/2 + 60);
        ctx.fillText('보통: 기본 난이도', canvas.width/2, canvas.height/2 + 90);
        ctx.fillText('어려움: 빠른 미사일, 높은 데미지, 2배 보상', canvas.width/2, canvas.height/2 + 120);
    }
}

// 난이도 설정 함수 수정
function setDifficulty(difficulty) {
    gameState.difficulty = difficulty;
    gameState.isPaused = false;
    gameState.isGameStarted = true;
    
    // 난이도 선택 UI 숨기기
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
        startScreen.classList.add('hidden');
    }
    
    // 게임 HUD 표시
    document.getElementById('hud').style.display = 'block';
    document.getElementById('stage-info').style.display = 'block';
    
    updateDifficultyButtons();
    resetGame();
}

// 미사일 적 생성 함수 수정
function createZombie() {
    const settings = difficultySettings[gameState.difficulty];
    
    // 플레이어 방향으로의 초기 각도 계산
    const targetX = player.x + player.width/2;
    const targetY = player.y + player.height/2;
    const spawnX = canvas.width + 50;
    const spawnY = Math.random() * (canvas.height - 200) + 100;
    const initialAngle = Math.atan2(targetY - spawnY, targetX - spawnX);

    const zombie = {
        x: spawnX,
        y: spawnY,
        width: 40,
        height: 20,
        speed: settings.missileSpeed,
        health: settings.missileHealth,
        damage: settings.missileDamage,
        angle: initialAngle,  // 초기 각도 설정
        type: 'normal'
    };
    zombies.push(zombie);
}

// 폭발 효과 생성
function createExplosion(x, y, radius) {
    // 메인 폭발
    explosions.push({
        x: x,
        y: y,
        radius: radius,
        maxRadius: radius,
        life: 40,
        type: 'main',
        color: '#ff4500'
    });

    // 작은 폭발들
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const distance = radius * 0.6;
        const speed = 2 + Math.random() * 2;
        explosions.push({
            x: x + Math.cos(angle) * distance,
            y: y + Math.sin(angle) * distance,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: radius * 0.3,
            maxRadius: radius * 0.3,
            life: 25,
            type: 'secondary',
            color: i % 2 === 0 ? '#ffd700' : '#ff6347'
        });
    }

    // 파티클 효과
    createParticles(x, y, '#ff4500', 40, 10);  // 붉은 파티클
    createParticles(x, y, '#ffd700', 30, 8);   // 황금색 파티클
    createParticles(x, y, '#ff8c00', 20, 6);   // 주황색 파티클
}

// 충돌 감지
function checkCollision(rect1, rect2) {
    // 총알과 좀비의 중심점 계산
    const rect1Center = {
        x: rect1.x + (rect1.width || 8) / 2,
        y: rect1.y + (rect1.height || 8) / 2
    };
    
    const rect2Center = {
        x: rect2.x + rect2.width / 2,
        y: rect2.y + rect2.height / 2
    };
    
    // 거리 기반 충돌 감지
    const dx = rect1Center.x - rect2Center.x;
    const dy = rect1Center.y - rect2Center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 충돌 범위 설정 (총알과 좀비 크기의 평균)
    const collisionRange = ((rect1.width || 8) + rect2.width) / 3;
    
    return distance < collisionRange;
}

// 게임 업데이트 함수 수정
function update() {
    if (gameState.isPaused || gameState.isGameOver) return;

    // PC 키보드 컨트롤
    if (keys['ArrowUp'] && player.y > 0) {
        player.y -= player.speed;
    }
    if (keys['ArrowDown'] && player.y < gameState.groundY - player.height) {
        player.y += player.speed;
    }
    if (keys['ArrowLeft'] && player.x > 0) {
        player.x -= player.speed;
        gameState.speed = Math.max(-gameState.maxSpeed, gameState.speed - 0.2);
    }
    if (keys['ArrowRight'] && player.x < canvas.width - player.width) {
        player.x += player.speed;
        gameState.speed = Math.min(gameState.maxSpeed, gameState.speed + 0.2);
    }
    if (keys[' ']) {  // 스페이스바로 발사
        createBullet();
    }

    // 모바일 컨트롤 처리
    const moveSpeed = player.speed * 1.2; // 모바일에서 약간 더 빠른 이동
    
    if (mobileControls.up && player.y > 0) {
        player.y -= moveSpeed;
    }
    if (mobileControls.down && player.y < gameState.groundY - player.height) {
        player.y += moveSpeed;
    }
    if (mobileControls.left && player.x > 0) {
        player.x -= moveSpeed;
        gameState.speed = Math.max(-gameState.maxSpeed, gameState.speed - 0.2);
    }
    if (mobileControls.right && player.x < canvas.width - player.width) {
        player.x += moveSpeed;
        gameState.speed = Math.min(gameState.maxSpeed, gameState.speed + 0.2);
    }
    if (mobileControls.shoot) {
        createBullet();
    }

    // 속도 자연스럽게 감소
    if (!keys['ArrowRight'] && !keys['ArrowLeft'] && !mobileControls.right && !mobileControls.left) {
        if (gameState.speed > 0) {
            gameState.speed -= 0.05;
        } else if (gameState.speed < 0) {
            gameState.speed += 0.05;
        }
    }

    // 배경 스크롤 속도 조정
    gameState.backgroundOffset += gameState.speed;

    // 총알 업데이트
    bullets.forEach((bullet, bulletIndex) => {
        if (bullet.type === 'rocket') {
            bullet.x += bullet.speed;
        } else {
            bullet.x += Math.cos(bullet.angle) * bullet.speed;
            bullet.y += Math.sin(bullet.angle) * bullet.speed;
        }

        // 화면 밖으로 나간 총알 제거
        if (bullet.x > canvas.width) {
            bullets.splice(bulletIndex, 1);
        }
    });

    // 미사일 업데이트
    zombies.forEach((missile, index) => {
        // 플레이어 방향으로의 각도 계산
        const targetAngle = Math.atan2(
            player.y + player.height/2 - (missile.y + missile.height/2),
            player.x + player.width/2 - (missile.x + missile.width/2)
        );

        // 현재 각도와 목표 각도의 차이 계산
        let angleDiff = targetAngle - missile.angle;
        
        // 각도 차이를 -PI에서 PI 사이로 정규화
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // 부드러운 회전
        missile.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.02);

        // 속도 계산
        missile.x += Math.cos(missile.angle) * missile.speed;
        missile.y += Math.sin(missile.angle) * missile.speed;

        // 화면 경계 체크
        if (missile.y < 0) missile.y = 0;
        if (missile.y > gameState.groundY - missile.height) {
            missile.y = gameState.groundY - missile.height;
        }

        // 플레이어와 충돌 체크
        if (checkCollision(missile, player)) {
            const settings = difficultySettings[gameState.difficulty];
            player.health -= settings.missileDamage;
            zombies.splice(index, 1);
            createExplosion(missile.x + missile.width/2, missile.y + missile.height/2, 80);
            playSound('explosion');

            if (player.health <= 0) {
                gameState.isGameOver = true;
                playSound('playerCrash');
                const finalScore = calculateScore();
                showGameOverDialog(finalScore);
                return;
            }
            updateUI();
        }

        // 화면 밖으로 나간 미사일 제거
        if (missile.x + missile.width < 0) {
            zombies.splice(index, 1);
        }
    });

    // 폭발 효과 업데이트
    explosions.forEach((explosion, index) => {
        explosion.life--;
        if (explosion.life <= 0) {
            explosions.splice(index, 1);
        }
    });

    // 파티클 업데이트
    particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life--;
        if (particle.life <= 0) {
            particles.splice(index, 1);
        }
    });
}

// 게임 그리기
function draw() {
    drawBackground();
    drawPlane(player.x, player.y, player.width, player.height);
    drawDashboard();
    
    // 좀비 그리기
    zombies.forEach(zombie => {
        drawZombie(zombie);
    });
    
    // 총알 그리기
    ctx.fillStyle = '#f1c40f';
    bullets.forEach(bullet => {
        if (bullet.type === 'rocket') {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, 8, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(bullet.x, bullet.y, 8, 8);
        }
    });
    
    // 폭발 효과 그리기
    explosions.forEach(explosion => {
        const lifePercent = explosion.life / (explosion.type === 'main' ? 30 : 20);
        
        if (explosion.type === 'fragment') {
            // 파편 효과
            explosion.x += explosion.vx;
            explosion.y += explosion.vy;
            explosion.vx *= 0.95;
            explosion.vy *= 0.95;
            
            ctx.fillStyle = explosion.color;
            ctx.globalAlpha = lifePercent;
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, explosion.radius * lifePercent, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 일반 폭발 효과
            const gradient = ctx.createRadialGradient(
                explosion.x, explosion.y, 0,
                explosion.x, explosion.y, explosion.radius
            );
            
            gradient.addColorStop(0, `rgba(255, 255, 255, ${lifePercent})`);
            gradient.addColorStop(0.2, `rgba(255, 69, 0, ${lifePercent})`);
            gradient.addColorStop(0.5, `rgba(255, 165, 0, ${lifePercent * 0.8})`);
            gradient.addColorStop(1, 'rgba(139, 0, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    
    // 파티클 그리기
    particles.forEach(particle => {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life / 30;
        ctx.fillRect(particle.x, particle.y, 4, 4);
    });
    ctx.globalAlpha = 1;
}

// 게임 리셋 함수 수정
function resetGame() {
    const currentMoney = gameState.money;  // 현재 돈 저장
    
    // 비행기 상태 초기화
    player.health = player.maxHealth;
    player.x = 150;
    player.y = canvas.height - 400;
    player.speed = 5;
    player.engineLevel = 1;
    player.armorLevel = 1;
    player.currentWeapon = 'machineGun';

    // 무기 상태 초기화
    Object.keys(weapons).forEach(weapon => {
        if (weapon !== 'machineGun') {
            weapons[weapon].unlocked = false;
        }
    });

    // 게임 상태 초기화
    gameState.stage = 1;
    gameState.kills = 0;
    gameState.requiredKills = 20;
    gameState.isGameOver = false;
    gameState.speed = 0;
    gameState.backgroundOffset = 0;
    gameState.money = currentMoney;

    // 게임 오브젝트 초기화
    zombies = [];
    bullets = [];
    explosions = [];
    particles = [];

    // UI 업데이트
    updateUI();
    updateWeaponUI();
}

// 게임 루프 수정
function gameLoop() {
    if (!gameState.isGameStarted) {
        drawStartScreen();
    } else {
        update();
        draw();
        
        // 미사일 생성 로직
        if (!gameState.isPaused && !gameState.isGameOver) {
            const settings = difficultySettings[gameState.difficulty];
            const baseSpawnRate = settings.spawnRate;
            const stageMultiplier = 1 + (gameState.stage - 1) * 0.05; // 스테이지별 증가율 감소 (0.08 -> 0.05)
            const finalSpawnRate = baseSpawnRate * stageMultiplier;
            
            if (Math.random() < finalSpawnRate) {
                createZombie();
            }
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// 게임 시작 시 HUD 숨기기
document.getElementById('hud').style.display = 'none';
document.getElementById('stage-info').style.display = 'none';

// 게임 루프 시작
gameLoop();

// 미사일 폭발 효과 함수 수정
function createMissileExplosion(x, y) {
    // 폭발 효과음 재생
    playSound('explosion');
    
    // 중앙 폭발
    explosions.push({
        x: x,
        y: y,
        radius: 40,
        maxRadius: 40,
        life: 30,
        type: 'main'
    });

    // 파편 효과
    for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        const speed = 3 + Math.random() * 2;
        const size = 10 + Math.random() * 10;
        
        explosions.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: size,
            maxRadius: size,
            life: 20,
            type: 'fragment',
            color: i % 2 === 0 ? '#ff4500' : '#ffd700'
        });
    }

    // 파티클 효과
    createParticles(x, y, '#ff4500', 20, 5);  // 붉은 파티클
    createParticles(x, y, '#ffd700', 15, 4);  // 황금색 파티클
}

// 점수 계산 함수
function calculateScore() {
    const difficultyMultiplier = {
        easy: 1,
        normal: 2,
        hard: 3
    };
    
    return Math.floor(
        gameState.kills * 100 +
        gameState.stage * 1000 +
        gameState.money * 0.5 +
        (difficultyMultiplier[gameState.difficulty] || 1) * 1000
    );
}

// 점수 저장 함수
function saveScore(playerName, score) {
    try {
        // 기존 점수 불러오기
        let scores = JSON.parse(localStorage.getItem('missileGameScores') || '[]');
        
        // 새로운 점수 추가
        scores.push({
            playerName,
            score,
            difficulty: gameState.difficulty,
            stage: gameState.stage,
            kills: gameState.kills,
            date: new Date().toLocaleDateString()
        });
        
        // 점수 내림차순 정렬
        scores.sort((a, b) => b.score - a.score);
        
        // 상위 100개 점수만 유지
        scores = scores.slice(0, 100);
        
        // 로컬 스토리지에 저장
        localStorage.setItem('missileGameScores', JSON.stringify(scores));
        
        return true;
    } catch (error) {
        console.error('점수 저장 실패:', error);
        return false;
    }
}

// 게임 오버 시 점수 기록 다이얼로그 표시
function showGameOverDialog(score) {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        padding: 20px;
        border-radius: 10px;
        border: 2px solid #ff4500;
        color: white;
        text-align: center;
        z-index: 1000;
        min-width: 300px;
    `;
    
    dialog.innerHTML = `
        <h2 style="color: #ff4500; margin-bottom: 20px;">게임 오버</h2>
        <div style="margin-bottom: 20px; font-size: 18px;">
            <p>난이도: ${gameState.difficulty.toUpperCase()}</p>
            <p>스테이지: ${gameState.stage}</p>
            <p>처치한 미사일: ${gameState.kills}</p>
            <p style="color: #ffd700; font-size: 24px; margin-top: 10px;">최종 점수: ${score}</p>
        </div>
        <input type="text" id="playerName" placeholder="플레이어 이름" maxlength="20" style="
            margin: 10px 0;
            padding: 8px;
            width: 200px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid #ff4500;
            color: white;
            border-radius: 5px;
            font-size: 16px;
        ">
        <div style="margin-top: 20px;">
            <button onclick="saveAndClose(this.parentElement.parentElement)" style="
                padding: 10px 20px;
                background: #ff4500;
                border: none;
                color: white;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin: 0 5px;
            ">점수 저장</button>
            <button onclick="showHighScores()" style="
                padding: 10px 20px;
                background: #4CAF50;
                border: none;
                color: white;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin: 0 5px;
            ">순위표</button>
        </div>
        <div style="margin-top: 10px;">
            <button onclick="restartGame(this.parentElement.parentElement)" style="
                padding: 10px 20px;
                background: #2196F3;
                border: none;
                color: white;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin: 0 5px;
            ">다시하기</button>
            <button onclick="exitGame(this.parentElement.parentElement)" style="
                padding: 10px 20px;
                background: #f44336;
                border: none;
                color: white;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin: 0 5px;
            ">게임 끝내기</button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    document.getElementById('playerName').focus();
}

// 순위표 표시 함수
function showHighScores() {
    const scores = JSON.parse(localStorage.getItem('missileGameScores') || '[]');
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        padding: 20px;
        border-radius: 10px;
        border: 2px solid #ff4500;
        color: white;
        text-align: center;
        z-index: 1001;
        max-height: 80vh;
        overflow-y: auto;
        min-width: 400px;
    `;
    
    let scoresHtml = '<h2 style="color: #ff4500; margin-bottom: 20px;">최고 점수</h2>';
    
    if (scores.length === 0) {
        scoresHtml += '<p>아직 기록된 점수가 없습니다.</p>';
    } else {
        scoresHtml += `
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: rgba(255, 69, 0, 0.3);">
                    <th style="padding: 8px;">순위</th>
                    <th style="padding: 8px;">이름</th>
                    <th style="padding: 8px;">점수</th>
                    <th style="padding: 8px;">난이도</th>
                </tr>
        `;
        
        scores.forEach((score, index) => {
            scoresHtml += `
                <tr style="border-bottom: 1px solid #333;">
                    <td style="padding: 8px;">${index + 1}</td>
                    <td style="padding: 8px;">${score.playerName}</td>
                    <td style="padding: 8px;">${score.score}</td>
                    <td style="padding: 8px;">${score.difficulty.toUpperCase()}</td>
                </tr>
            `;
        });
        
        scoresHtml += '</table>';
    }
    
    scoresHtml += `
        <button onclick="this.parentElement.remove()" style="
            margin-top: 20px;
            padding: 10px 20px;
            background: #333;
            border: none;
            color: white;
            border-radius: 5px;
            cursor: pointer;
        ">닫기</button>
    `;
    
    dialog.innerHTML = scoresHtml;
    document.body.appendChild(dialog);
}

// 게임 다시 시작 함수
function restartGame(dialog) {
    // 게임 상태 초기화
    gameState.isGameStarted = false;
    gameState.difficulty = null;
    gameState.money = 0;
    
    // 게임 오버 다이얼로그 닫기
    if (dialog) {
        dialog.remove();
    }
    
    // 시작 화면으로 돌아가기
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
        startScreen.classList.remove('hidden');
    }
    
    // HUD 숨기기
    document.getElementById('hud').style.display = 'none';
    document.getElementById('stage-info').style.display = 'none';
    
    // 게임 초기화
    resetGame();
}

// 게임 종료 함수
function exitGame(dialog) {
    if (confirm('정말로 게임을 종료하시겠습니까?')) {
        // 게임 오버 다이얼로그 닫기
        if (dialog) {
            dialog.remove();
        }
        
        // 게임 상태 초기화
        gameState.isGameStarted = false;
        gameState.difficulty = null;
        gameState.money = 0;
        
        // 시작 화면 표시
        const startScreen = document.getElementById('start-screen');
        if (startScreen) {
            startScreen.classList.remove('hidden');
        }
        
        // HUD 숨기기
        document.getElementById('hud').style.display = 'none';
        document.getElementById('stage-info').style.display = 'none';
        
        // 게임 초기화
        resetGame();
    }
}

// 점수 저장 및 다이얼로그 닫기 함수 수정
function saveAndClose(dialog) {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        alert('플레이어 이름을 입력해주세요.');
        return;
    }
    
    const score = calculateScore();
    const saved = saveScore(playerName, score);
    
    if (saved) {
        alert('점수가 성공적으로 저장되었습니다!');
        showHighScores();
        
        // 다시하기/종료하기 버튼만 표시
        dialog.innerHTML = `
            <h2 style="color: #ff4500; margin-bottom: 20px;">게임 종료</h2>
            <div style="margin-top: 20px;">
                <button onclick="restartGame(this.parentElement.parentElement)" style="
                    padding: 10px 20px;
                    background: #2196F3;
                    border: none;
                    color: white;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                    margin: 0 5px;
                ">다시하기</button>
                <button onclick="exitGame(this.parentElement.parentElement)" style="
                    padding: 10px 20px;
                    background: #f44336;
                    border: none;
                    color: white;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                    margin: 0 5px;
                ">게임 끝내기</button>
            </div>
        `;
    } else {
        alert('점수 저장에 실패했습니다. 나중에 다시 시도해주세요.');
    }
}

// 모바일 컨트롤 이벤트 리스너
function setupMobileControls() {
    const buttons = {
        'up-button': 'up',
        'down-button': 'down',
        'left-button': 'left',
        'right-button': 'right',
        'shoot-button': 'shoot'
    };

    Object.entries(buttons).forEach(([buttonId, control]) => {
        const button = document.getElementById(buttonId);
        if (button) {
            // 터치 시작
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                mobileControls[control] = true;
                if (control === 'shoot') {
                    createBullet();
                }
            });

            // 터치 종료
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                mobileControls[control] = false;
            });

            // 마우스 이벤트 (테스트용)
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                mobileControls[control] = true;
                if (control === 'shoot') {
                    createBullet();
                }
            });

            button.addEventListener('mouseup', (e) => {
                e.preventDefault();
                mobileControls[control] = false;
            });
        }
    });
}

// 조이스틱 초기화
function initJoystick() {
    const joystickArea = document.getElementById('joystick-area');
    const joystick = document.getElementById('joystick');
    const shootButton = document.getElementById('mobile-shoot');

    let shootInterval = null;

    // 조이스틱 이벤트
    joystickArea.addEventListener('touchstart', handleJoystickStart);
    joystickArea.addEventListener('touchmove', handleJoystickMove);
    joystickArea.addEventListener('touchend', handleJoystickEnd);

    // 발사 버튼 이벤트
    shootButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        mobileControls.shoot = true;
        // 연속 발사 시작
        if (!shootInterval) {
            shootInterval = setInterval(() => {
                if (!gameState.isPaused && !gameState.isGameOver) {
                    createBullet();
                }
            }, weapons[player.currentWeapon].fireRate);
        }
        // 첫 발사
        createBullet();
    });

    shootButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        mobileControls.shoot = false;
        // 연속 발사 중지
        if (shootInterval) {
            clearInterval(shootInterval);
            shootInterval = null;
        }
    });

    // 조이스틱 위치 초기화
    const areaRect = joystickArea.getBoundingClientRect();
    joystickState.centerX = areaRect.width / 2;
    joystickState.centerY = areaRect.height / 2;
}

// 조이스틱 위치 업데이트
function updateJoystickPosition(touch) {
    const joystickArea = document.getElementById('joystick-area');
    const joystick = document.getElementById('joystick');
    const areaRect = joystickArea.getBoundingClientRect();

    // 터치 위치 계산
    const touchX = touch.clientX - areaRect.left;
    const touchY = touch.clientY - areaRect.top;

    // 중심점으로부터의 거리와 각도 계산
    const deltaX = touchX - joystickState.centerX;
    const deltaY = touchY - joystickState.centerY;
    const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), joystickState.maxDistance);
    const angle = Math.atan2(deltaY, deltaX);

    // 조이스틱 노브 위치 계산
    const knobX = joystickState.centerX + distance * Math.cos(angle);
    const knobY = joystickState.centerY + distance * Math.sin(angle);

    // 조이스틱 노브 이동
    joystick.style.transform = `translate(${knobX - joystickState.centerX}px, ${knobY - joystickState.centerY}px)`;

    // 이동 방향 설정 (민감도 조정)
    const normalizedX = deltaX / joystickState.maxDistance;
    const normalizedY = deltaY / joystickState.maxDistance;
    const threshold = 0.2; // 민감도 임계값

    // 컨트롤 상태 업데이트 (부드러운 이동)
    mobileControls.left = normalizedX < -threshold;
    mobileControls.right = normalizedX > threshold;
    mobileControls.up = normalizedY < -threshold;
    mobileControls.down = normalizedY > threshold;

    // 이동 속도 조절
    if (Math.abs(normalizedX) > threshold) {
        gameState.speed = normalizedX * gameState.maxSpeed;
    }
}

// 조이스틱 초기 위치로 리셋
function resetJoystick() {
    const joystick = document.getElementById('joystick');
    joystick.style.transform = 'translate(0, 0)';
    gameState.speed = 0;

    // 모든 방향키 상태 초기화
    mobileControls.left = false;
    mobileControls.right = false;
    mobileControls.up = false;
    mobileControls.down = false;
}

// 조이스틱 터치 시작
function handleJoystickStart(e) {
    e.preventDefault();
    joystickState.active = true;
    updateJoystickPosition(e.touches[0]);
}

// 조이스틱 터치 이동
function handleJoystickMove(e) {
    e.preventDefault();
    if (joystickState.active) {
        updateJoystickPosition(e.touches[0]);
    }
}

// 조이스틱 터치 종료
function handleJoystickEnd(e) {
    e.preventDefault();
    joystickState.active = false;
    resetJoystick();
} 