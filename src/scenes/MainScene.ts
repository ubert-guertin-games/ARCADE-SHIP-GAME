import Phaser from 'phaser';

const METEOR_TYPES = ['m1', 'm2', 'm3'] as const;
const SPAWN_INTERVAL_MS = 2000;
const BG_SCROLL_SPEED = 300; // px/sec
const SHIP_SPEED = 400;      // px/sec
const METEOR_SPEED = 250;    // px/sec
const MAX_LIVES = 3;
const INVINCIBLE_MS = 2000;

export class MainScene extends Phaser.Scene {
  private bg1!: Phaser.GameObjects.Image;
  private bg2!: Phaser.GameObjects.Image;
  private border!: Phaser.GameObjects.Image;
  private ship!: Phaser.Physics.Arcade.Sprite;
  private meteors!: Phaser.Physics.Arcade.Group;
  private bar!: Phaser.GameObjects.Sprite;
  private scoreText!: Phaser.GameObjects.Text;

  private btnL!: Phaser.GameObjects.Image;
  private btnR!: Phaser.GameObjects.Image;
  private leftMove = false;
  private rightMove = false;

  private score = 0;
  private lives = MAX_LIVES;
  private invincible = false;
  private invincibleTimer = 0;
  private flashTween: Phaser.Tweens.Tween | null = null;
  private spawnTimer = 0;
  private gameOver = false;

  constructor() {
    super('MainScene');
  }

  preload(): void {
    this.load.image('border', 'assets/border.png');
    this.load.image('background', 'assets/background.png');
    this.load.image('ship', 'assets/ship.png');
    this.load.image('m1', 'assets/m1.png');
    this.load.image('m2', 'assets/m2.png');
    this.load.image('m3', 'assets/m3.png');
    this.load.spritesheet('buttons', 'assets/btn-130x120.png', { frameWidth: 130, frameHeight: 120 });
    this.load.spritesheet('bar', 'assets/statBar-580x120.png', { frameWidth: 580, frameHeight: 120 });
    this.load.audio('music', 'music/play-again-classic-arcade-game-116820.mp3');
    this.load.audio('impact', 'music/vibrating-thud-39536.mp3');
  }

  create(): void {
    const { width, height } = this.scale;

    // Scrolling background (two tiles)
    this.bg1 = this.add.image(0, 0, 'background').setOrigin(0, 0);
    this.bg2 = this.add.image(0, -height, 'background').setOrigin(0, 0);

    // Meteors group — velocity-driven so physics handles movement
    this.meteors = this.physics.add.group();

    // Ship
    this.ship = this.physics.add.sprite(width / 2 - 40, height - 660, 'ship').setOrigin(0, 0);
    this.ship.setCollideWorldBounds(true);

    // Collider (registered once)
    this.physics.add.overlap(this.ship, this.meteors, this.onHit, undefined, this);

    // Border on top
    this.border = this.add.image(0, 0, 'border').setOrigin(0, 0).setDepth(10);

    // HUD
    this.bar = this.add.sprite(60, 100, 'bar', 0).setOrigin(0, 0).setDepth(11);
    this.scoreText = this.add.text(width / 2, 140, '0', {
      fontSize: '80px',
      fontFamily: 'pixelMoney',
      color: '#d0d058',
    }).setOrigin(0.5, 0.5).setDepth(12);

    // Buttons
    this.createButtons();

    // Audio
    this.sound.add('music', { volume: 0.5, loop: true }).play();

    // Keyboard
    this.input.keyboard?.on('keydown-LEFT',  () => { this.leftMove = true;  this.rightMove = false; });
    this.input.keyboard?.on('keyup-LEFT',    () => { this.leftMove = false; });
    this.input.keyboard?.on('keydown-RIGHT', () => { this.rightMove = true; this.leftMove = false; });
    this.input.keyboard?.on('keyup-RIGHT',   () => { this.rightMove = false; });
    this.input.keyboard?.on('keydown-A',     () => { this.leftMove = true;  this.rightMove = false; });
    this.input.keyboard?.on('keyup-A',       () => { this.leftMove = false; });
    this.input.keyboard?.on('keydown-D',     () => { this.rightMove = true; this.leftMove = false; });
    this.input.keyboard?.on('keyup-D',       () => { this.rightMove = false; });
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    const dt = delta / 1000;

    this.scrollBackground(dt);
    this.moveShip(dt);
    this.tickSpawn(delta);
    this.cullMeteors();

    if (this.invincible) {
      this.invincibleTimer -= delta;
      if (this.invincibleTimer <= 0) this.invincible = false;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private scrollBackground(dt: number): void {
    const h = this.scale.height;
    this.bg1.y += BG_SCROLL_SPEED * dt;
    this.bg2.y += BG_SCROLL_SPEED * dt;
    if (this.bg1.y >= h) this.bg1.y = this.bg2.y - h;
    if (this.bg2.y >= h) this.bg2.y = this.bg1.y - h;
  }

  private moveShip(dt: number): void {
    const vel = SHIP_SPEED * dt;
    const minX = 40;
    const maxX = this.scale.width - 140;
    if (this.leftMove)       this.ship.x = Math.max(minX, this.ship.x - vel);
    else if (this.rightMove) this.ship.x = Math.min(maxX, this.ship.x + vel);
  }

  private tickSpawn(delta: number): void {
    this.spawnTimer += delta;
    if (this.spawnTimer >= SPAWN_INTERVAL_MS) {
      this.spawnTimer -= SPAWN_INTERVAL_MS;
      this.spawnMeteor();
    }
  }

  private spawnMeteor(): void {
    const x = Phaser.Math.Between(150, 500);
    const type = METEOR_TYPES[Phaser.Math.Between(0, 2)];
    const m = this.meteors.create(x, -100, type) as Phaser.Physics.Arcade.Sprite;
    m.setVelocityY(METEOR_SPEED);
    this.score++;
    this.scoreText.setText(this.score.toString());
  }

  private cullMeteors(): void {
    const limit = this.scale.height + 150;
    this.meteors.getChildren().forEach((obj) => {
      const m = obj as Phaser.Physics.Arcade.Sprite;
      if (m.y > limit) m.destroy();
    });
  }

  private onHit(_ship: Phaser.GameObjects.GameObject, meteor: Phaser.GameObjects.GameObject): void {
    if (this.invincible) return;
    this.invincible = true;
    this.invincibleTimer = INVINCIBLE_MS;

    (this.sound.get('impact') ?? this.sound.add('impact', { volume: 1 })).play();
    meteor.destroy();

    this.lives--;
    const barFrame = MAX_LIVES - this.lives;
    this.bar.setFrame(barFrame);

    // Flash ship: alternate between red tint and invisible, for 2s
    this.flashTween?.stop();
    this.ship.setTint(0xff4444);
    let flashCount = 0;
    this.flashTween = this.tweens.add({
      targets: this.ship,
      alpha: 0,
      duration: 120,
      yoyo: true,
      repeat: 7,
      onYoyo: () => {
        flashCount++;
        this.ship.setTint(flashCount % 2 === 0 ? 0xff4444 : 0xffffff);
      },
      onComplete: () => {
        this.ship.setAlpha(1);
        this.ship.clearTint();
      },
    });

    if (this.lives <= 0) this.endGame();
  }

  private endGame(): void {
    this.gameOver = true;
    this.ship.destroy();
    this.meteors.clear(true, true);
    this.add.text(120, this.scale.height / 2 - 80, `Game Over\n\nScore: ${this.score}`, {
      fontSize: '80px',
      fontFamily: 'pixelMoney',
      color: '#d0d058',
    }).setDepth(20);
  }

  private createButtons(): void {
    const { width, height } = this.scale;

    this.btnL = this.add.image(150, height - 160, 'buttons').setFrame(1).setScale(1.2).setInteractive().setDepth(15);
    this.btnR = this.add.image(width - 150, height - 160, 'buttons').setFrame(0).setScale(1.2).setInteractive().setDepth(15);

    this.btnL.on('pointerdown', () => { this.leftMove = true;  this.rightMove = false; });
    this.btnL.on('pointerup',   () => { this.leftMove = false; });
    this.btnL.on('pointerout',  () => { this.leftMove = false; });

    this.btnR.on('pointerdown', () => { this.rightMove = true; this.leftMove = false; });
    this.btnR.on('pointerup',   () => { this.rightMove = false; });
    this.btnR.on('pointerout',  () => { this.rightMove = false; });
  }
}
