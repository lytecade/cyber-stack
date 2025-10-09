const StackSettings = {
    TileSize: 8,
    TileMaxWidthBounds: 96,
    TileMaxHeightBounds: 552,
    TileBuffer: 3,
};

const SpeedTypes = {
    Normal: 25,
    SpeedTwo: 40,
    SpeedThree: 55,
    SpeedFour: 70,
    SpeedFive: 85,
    SpeedMax: 100,
};

class UIs {
    static setButtonInput = (scene, buttonReference, stopKey, startKey) => {
        scene.input.on('pointerdown', function (pointer) {
            if (buttonReference.getBounds().contains(pointer.x, pointer.y)) {
                scene.scene.stop(stopKey);
                scene.scene.start(startKey);
            }
        });
    }
    static initHudCounter = (scene) => {
        scene.hudCounters = [0, 0];
        scene.hudCounterImages = [];
        for (let i = 0; i < scene.hudCounters.length; i++) {
            scene.hudCounterImages.push(scene.add.image(18 + (i * 4), 6, 'sprite-hud', 0).setOrigin(1, 0).setScrollFactor(0));
        }
    }
    static updateHudCounter = (scene) => {
        scene.hudCounters[scene.hudCounters.length - 1]++;
        for (let i = scene.hudCounters.length - 1; i >= 0; i--) {
            if (scene.hudCounters[i] > 9) {
                scene.hudCounters[i] = 0;
                if (i > 0) {
            	scene.hudCounters[i - 1]++;
                }
            }
        }
        for (let i = 0; i < scene.hudCounters.length; i++) {
            scene.hudCounterImages[i].setFrame(scene.hudCounters[i]);
        }
    }
    static setScreenStatus = (scene, screenGame) => {
        if (screenGame.scale.isFullscreen) {
            scene.screenBar = scene.add.image(86, 6, 'sprite-hud', 12).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
        } else {
            scene.screenBar = scene.add.image(86, 6, 'sprite-hud', 13).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
        }
    }
    static setScreenBar = (scene, screenBarReference, screenGame) => {
        scene.input.on('pointerdown', function (pointer) {
            if (screenBarReference.getBounds().contains(pointer.x, pointer.y)) {
                if (!screenGame.scale.isFullscreen) {
                    screenBarReference.setFrame(12);
                    screenGame.scale.startFullscreen();
                } else {
                    screenBarReference.setFrame(13);
                    screenGame.scale.stopFullscreen();
                }
            } 
        });
    }
    static setAudioStatus = (scene, settings) => {
        if (settings.get('settingAudioActive') === undefined) {
            settings.set('settingAudioActive', true);
            scene.audioBar = scene.add.image(76, 6, 'sprite-hud', 10).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
            scene.sound.volume = 1;
        } else if (settings.get('settingAudioActive') === false) {
            scene.audioBar = scene.add.image(76, 6, 'sprite-hud', 11).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
            scene.sound.volume = 0;
        } else {
            scene.audioBar = scene.add.image(76, 6, 'sprite-hud', 10).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
            scene.sound.volume = 1;
        }
    }
    static setAudioUpdate = (scene) => {
        if (scene.audioBar.frame.name == 11) {
            scene.sound.volume = 0;
        } else if (scene.audioBar.frame.name == 10) {
            scene.sound.volume = 1;
        }
    }
    static setAudioBar = (scene, audioBarReference, audioBarPressedReference) => {
        scene.input.on('pointerdown', function (pointer) {
            if (audioBarReference.getBounds().contains(pointer.x, pointer.y)) {
                if (audioBarPressedReference.registry.get('settingAudioActive') === true) {
                    audioBarReference.setFrame(11);
                    audioBarPressedReference.registry.set('settingAudioActive', false);
                } else {
                    audioBarReference.setFrame(10);
                    audioBarPressedReference.registry.set('settingAudioActive', true);
                }
            } 
        });
    }
}

class Stack {
    constructor(scene, x, y, currentFrame, currentSize, currentCount) {
        this.x = x;
        this.y = y;
        this.scene = scene;
        this.currentFrame = currentFrame;
        this.currentSize = currentSize;
        this.currentCount = currentCount;
        this.currentSpeed = SpeedTypes.Normal;
        this.sprite = scene.physics.add.sprite(x, y, "sprite-stack", currentFrame).setMaxVelocity(60, 60).setSize(currentSize, 8).setOrigin(0.5, 0.5).setOffset(0, 0);
        this.spriteCollider = scene.physics.world.addCollider(this.sprite, scene.groundLayer);
        this.movementState = true;
        this.movementRight = true;
        this.pointerDownFlag = false;
        const { ENTER, SPACE } = Phaser.Input.Keyboard.KeyCodes; 
        this.keys = scene.input.keyboard.addKeys({ enter: ENTER, space: SPACE });
    }
    update() {
        const { keys, sprite } = this; 
        if (sprite.body) {
            let currentScene = this.scene;
            currentScene.input.on('pointerdown', (pointer) => {
                this.pointerDownFlag = (pointer.y > 14) ? true : this.pointerDownFlag;
            });
            if (this.sprite.body.blocked.left) {
                this.movementRight = true;
            } else if (this.sprite.body.blocked.right) { 
                this.movementRight = false;
            }
            if (this.movementState === true) {
                if (Phaser.Input.Keyboard.JustDown(keys.space) || Phaser.Input.Keyboard.JustDown(keys.enter) || this.pointerDownFlag === true) {
                    this.movementState = false;
                    this.pointerDownFlag = false;
                }
            }
            this.currentSpeed = this.getSpeed(this.currentCount, this.currentSpeed);
            sprite.body.setVelocityX(this.movementState ? (this.movementRight === true ? this.currentSpeed : -this.currentSpeed) : 0);
        }
    }
    getSpeed(currentCount, currentSpeed) {
        let speedFactor = Math.abs(currentCount - (currentCount % 4));
        let returnSpeed;
        switch (speedFactor) {
            case 16:
                returnSpeed = SpeedTypes.SpeedFive; 
                break;
            case 12:
                returnSpeed = SpeedTypes.SpeedFour; 
                break;
            case 8:
                returnSpeed = SpeedTypes.SpeedThree; 
                break;
            case 4:
                returnSpeed = SpeedTypes.SpeedTwo; 
                break;
            default:
                returnSpeed = (speedFactor >= 16) ? SpeedTypes.SpeedMax : currentSpeed; 
                break;
        }   
        return returnSpeed;
    }
}

class InitScene extends Phaser.Scene {
    constructor() {
        super({ key: 'InitScene' });
    }
    preload() {
        this.load.image("image-title", "assets/image-title.png");
        this.load.image("image-playbutton", "assets/image-playbutton.png");
    }
    create() {
        let scene = this;
        let centerX = this.cameras.main.width / 2;
        const { ENTER, SPACE } = Phaser.Input.Keyboard.KeyCodes;
        this.keys = this.input.keyboard.addKeys({ enter: ENTER, space: SPACE });
        this.textures.generate('textureBackground', {
            data: ['DD'],
            pixelWidth: 1,
            pixelHeight: 1
        });
        this.add.image(0, 0, 'textureBackground').setOrigin(0, 0).setScrollFactor(0).setDisplaySize(96, 96);
        this.game.scale.fullScreenTarget = document.documentElement; 
        this.titleBanner = this.add.image(centerX, 26, "image-title").setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
        let buttonPlay = this.add.image(centerX, 59, "image-playbutton").setOrigin(0.5, 0).setScrollFactor(0).setDepth(100); 
        this.input.on('pointerdown', function (pointer) {
            if (buttonPlay.getBounds().contains(pointer.x, pointer.y)) {
                scene.scene.stop(scene.key);
                scene.scene.start('ActionScene');
            }
        });
    }
    update() {
        const { keys } = this;
        if (Phaser.Input.Keyboard.JustDown(keys.enter)) {
            this.scene.stop('InitScene');
            this.scene.start('ActionScene');
        } else if (Phaser.Input.Keyboard.JustDown(keys.space)) {
            this.scene.stop('InitScene');
            this.scene.start('GuideScene');
        }
    }
}

class ActionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ActionScene' });
    }
    preload() {
        this.load.spritesheet("sprite-hud", "assets/sprite-hud.png", { frameWidth: 8, frameHeight: 8, margin: 0, spacing: 0 });
        this.load.spritesheet("sprite-stack", "assets/sprite-stack.png", { frameWidth: 32, frameHeight: 8, margin: 0, spacing: 0 });
        this.load.image("tileset-stacks", "assets/tileset-stacks.png");
        this.load.audio("sfx-click", "assets/sfx-click.wav");
    }
    create() {
        this.textures.generate('textureBackground', {
            data: ['DD'],
            pixelWidth: 1,
            pixelHeight: 1
        });
        this.add.image(0, 0, 'textureBackground').setOrigin(0, 0).setScrollFactor(0).setDisplaySize(96, 96);
        this.clickSound = this.sound.add("sfx-click");
        this.game.scale.fullScreenTarget = document.documentElement; 
        this.tiles = [];
        this.tileSwitch = [];
        this.mainStacks = [];
        this.generateMap();
        UIs.initHudCounter(this);
        UIs.setAudioStatus(this, this.game.registry);
        UIs.setAudioBar(this, this.audioBar, this.game);
        UIs.setScreenStatus(this, this.game);
        UIs.setScreenBar(this, this.screenBar, this.game);
    }
    update() {
        UIs.setAudioUpdate(this);
        if (this.mainStacks.length > 0) {
            this.mainStacks[this.mainStacks.length - 1].update();
            if (this.mainStacks[this.mainStacks.length - 1].movementState === false) {
                let currentSize = this.mainStacks[this.mainStacks.length - 1].currentSize;
                let currentFrame = this.mainStacks[this.mainStacks.length - 1].currentFrame;
                let currentX = this.mainStacks[this.mainStacks.length - 1].sprite.x;
                let currentY = this.mainStacks[this.mainStacks.length - 1].sprite.y;
                if (this.mainStacks.length > 1) {
                    let stackRecent = Math.round(this.mainStacks[this.mainStacks.length - 1].sprite.x);
                    let stackPrevious = Math.round(this.mainStacks[this.mainStacks.length - 2].sprite.x);
                    if (stackRecent < stackPrevious) {
                        currentSize = currentSize - (stackPrevious - stackRecent)
                    } else {
                        let previousTotal = this.mainStacks[this.mainStacks.length - 2].currentSize + stackPrevious;
                        let currentTotal = currentSize + stackRecent;
                        let deductionValue = (currentTotal - previousTotal);
                        currentSize = deductionValue < 0 ? currentSize : (currentSize - deductionValue);
                    }
                    currentFrame = 32 - currentSize;
                }
	        if (currentFrame >= 32) {
                    this.physics.pause();
                    this.time.delayedCall(3000, () => {
                      this.scene.restart();
                    }, [], this);
	        } else {
                    UIs.updateHudCounter(this);
	            this.mainStacks.push(new Stack(this, currentX, currentY - 8, currentFrame, currentSize, this.mainStacks.length));
                    this.clickSound.play();
                    if (currentY < (StackSettings.TileMaxHeightBounds - 56)) {
                        this.setCamera((this.mainStacks.length * 8) - 48);
                    }
	        }
            }
        }
    }
    generateMap() {
        const tileRows = Math.min(Math.floor(StackSettings.TileMaxHeightBounds / StackSettings.TileSize));
        const widthInTiles = Math.min(Math.floor(StackSettings.TileMaxWidthBounds / StackSettings.TileSize));
        for (let row = 0; row < tileRows; row++) {
            this.tiles[row] = [];
            for (let column = 0; column < widthInTiles; column++) {
                if (row === (tileRows - 1)) {
                    if (column == 0) {
                        this.tiles[row][column] = 3;
                    } else if (column == (widthInTiles - 1)) {
                        this.tiles[row][column] = 5;
                    } else {
                        this.tiles[row][column] = 4;
                    }
                } else {
                    if (column == 0) {
                        this.tiles[row][column] = 1;
                    } else if (column == (widthInTiles - 1)) {
                        this.tiles[row][column] = 2;
                    } else {
                        this.tiles[row][column] = 0;
                    }
                }
            }
        }
        const map = this.make.tilemap({
            data: this.tiles,
            tileWidth: StackSettings.TileSize,
            tileHeight: StackSettings.TileSize
        });
        this.groundLayer = map.createLayer(0, map.addTilesetImage("tileset-stacks", "tileset-stacks"), this.x, 0).setCollisionByExclusion([-1, 0]);
        if (this.mainStacks.length === 0) {
            this.mainStacks.push(new Stack(this, 32, Math.min(StackSettings.TileMaxHeightBounds - 12), 0, 32, this.mainStacks.length));
            this.setCamera(0);
        }
    }
    setCamera(offsetY) {
        this.cameras.main.setBounds(0, Math.min((StackSettings.TileMaxHeightBounds - this.sys.game.config.height) - offsetY), this.sys.game.config.width, this.sys.game.config.height);
    }
}

const game = new Phaser.Game({
    parent: "game",
    type: Phaser.AUTO,
    width: 96,
    height: 96,
    pixelArt: true,
    scene: [InitScene, ActionScene],
    physics: {
        default: "arcade",
        arcade : {
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    }
});

