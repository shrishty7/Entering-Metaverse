import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';
import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/FBXLoader.js';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/controls/OrbitControls.js';

import connect from "./connect.js";
var camera;
var model = [];
class BasicCharacterControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }

  get animations() {
    return this._animations;
  }
};
const LoadingManager = new THREE.LoadingManager();

LoadingManager.onStart = function(url, item, total){
  console.log(`Started Loading: ${url}`);
}
LoadingManager.onProgress = function(url, loaded, total){
  // console.log(`222: ${url}`);
}
LoadingManager.onLoad = function() {
  console.log(`Just finished Loading`);
}

class BasicCharacterController {
  constructor(params) {
    this._Init(params);
  }

  _Init(params) {
    this._params = params;
    this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
    this._acceleration = new THREE.Vector3(10, 0.25, 500.0);
    this._velocity = new THREE.Vector3(0, 0, 0);
    this._position = new THREE.Vector3(1, 1, 1);

    this._animations = {};
    this._input = new BasicCharacterControllerInput();
    this._stateMachine = new CharacterFSM(
        new BasicCharacterControllerProxy(this._animations));

    this._LoadModels();
  }

  _LoadModels() {
    const loader = new FBXLoader(LoadingManager);
    loader.setPath('./resources/zombie/AJ/');
    loader.load('AJ.fbx', (fbx) => {
      fbx.scale.setScalar(0.17);
      fbx.traverse(c => {
        c.castShadow = true;
      });
      this._target = fbx;
      this._params.scene.add(this._target);

      this._mixer = new THREE.AnimationMixer(this._target);

      this._manager = new THREE.LoadingManager();
      this._manager.onLoad = () => {
        this._stateMachine.SetState('idle');
      };

      const _OnLoad = (animName, anim) => {
        const clip = anim.animations[0];
        const action = this._mixer.clipAction(clip);
  
        this._animations[animName] = {
          clip: clip,
          action: action,
        };
      };

      const loader = new FBXLoader(this._manager);
      loader.setPath('./resources/zombie/AJ/');
      loader.load('WalkAJ.fbx', (a) => { _OnLoad('walk', a); });
      loader.load('RunAJ.fbx', (a) => { _OnLoad('run', a); });
      loader.load('IdleAJ.fbx', (a) => { _OnLoad('idle', a); });
      loader.load('DanceAJ.fbx', (a) => { _OnLoad('dance', a); });
    });
  }

  get Position() {
    return this._position;
  }

  get Rotation() {
    if (!this._target) {
      return new THREE.Quaternion();
    }
    return this._target.quaternion;
  }

  Update(timeInSeconds) {
    if (!this._stateMachine._currentState) {
      return;
    }

    this._stateMachine.Update(timeInSeconds, this._input);

    const velocity = this._velocity;
    const frameDecceleration = new THREE.Vector3(
        velocity.x * this._decceleration.x,
        velocity.y * this._decceleration.y,
        velocity.z * this._decceleration.z
    );
    frameDecceleration.multiplyScalar(timeInSeconds);
    frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
        Math.abs(frameDecceleration.z), Math.abs(velocity.z));

    velocity.add(frameDecceleration);

    const controlObject = this._target;
    const _Q = new THREE.Quaternion();
    const _A = new THREE.Vector3();
    const _R = controlObject.quaternion.clone();

    const acc = this._acceleration.clone();
    if (this._input._keys.shift) {
      acc.multiplyScalar(2.0);
    }

    if (this._stateMachine._currentState.Name == 'dance') {
      acc.multiplyScalar(0.0);
    }

    if (this._input._keys.forward) {
      velocity.z += acc.z * timeInSeconds;
    }
    if (this._input._keys.backward) {
      velocity.z -= acc.z * timeInSeconds;
    }
    if (this._input._keys.left) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }
    if (this._input._keys.right) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }

    controlObject.quaternion.copy(_R);

    const oldPosition = new THREE.Vector3();
    oldPosition.copy(controlObject.position);

    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(controlObject.quaternion);
    forward.normalize();

    const sideways = new THREE.Vector3(1, 0, 0);
    sideways.applyQuaternion(controlObject.quaternion);
    sideways.normalize();

    sideways.multiplyScalar(velocity.x * timeInSeconds);
    forward.multiplyScalar(velocity.z * timeInSeconds);

    controlObject.position.add(forward);
    controlObject.position.add(sideways);

    this._position.copy(controlObject.position);

    if (this._mixer) {
      this._mixer.update(timeInSeconds);
    }
  }
};

class BasicCharacterControllerInput {
  constructor() {
    this._Init();    
  }

  _Init() {
    this._keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
    };
    document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
  }

  _onKeyDown(event) {
    switch (event.keyCode) {
      case 87: // w
        this._keys.forward = true;
        break;
      case 65: // a
        this._keys.left = true;
        break;
      case 83: // s
        this._keys.backward = true;
        break;
      case 68: // d
        this._keys.right = true;
        break;
      case 32: // SPACE
        this._keys.space = true;
        break;
      case 16: // SHIFT
        this._keys.shift = true;
        break;
    }
  }

  _onKeyUp(event) {
    switch(event.keyCode) {
      case 87: // w
        this._keys.forward = false;
        break;
      case 65: // a
        this._keys.left = false;
        break;
      case 83: // s
        this._keys.backward = false;
        break;
      case 68: // d
        this._keys.right = false;
        break;
      case 32: // SPACE
        this._keys.space = false;
        break;
      case 16: // SHIFT
        this._keys.shift = false;
        break;
    }
  }
};

class FiniteStateMachine {
  constructor() {
    this._states = {};
    this._currentState = null;
  }

  _AddState(name, type) {
    this._states[name] = type;
  }

  SetState(name) {
    const prevState = this._currentState;
    
    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.Exit();
    }

    const state = new this._states[name](this);

    this._currentState = state;
    state.Enter(prevState);
  }

  Update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.Update(timeElapsed, input);
    }
  }
};

class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this._Init();
  }

  _Init() {
    this._AddState('idle', IdleState);
    this._AddState('walk', WalkState);
    this._AddState('run', RunState);
    this._AddState('dance', DanceState);
  }
};

class State {
  constructor(parent) {
    this._parent = parent;
  }

  Enter() {}
  Exit() {}
  Update() {}
};

class DanceState extends State {
  constructor(parent) {
    super(parent);

    this._FinishedCallback = () => {
      this._Finished();
    }
  }

  get Name() {
    return 'dance';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['dance'].action;
    const mixer = curAction.getMixer();
    mixer.addEventListener('finished', this._FinishedCallback);

    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.reset();  
      curAction.setLoop(THREE.LoopOnce, 1);
      curAction.clampWhenFinished = true;
      curAction.crossFadeFrom(prevAction, 0.2, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  _Finished() {
    this._Cleanup();
    this._parent.SetState('idle');
  }

  _Cleanup() {
    const action = this._parent._proxy._animations['dance'].action;
    
    action.getMixer().removeEventListener('finished', this._CleanupCallback);
  }

  Exit() {
    this._Cleanup();
  }

  Update(_) {
  }
};

class WalkState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'walk';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['walk'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'run') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (input._keys.shift) {
        this._parent.SetState('run');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};

class RunState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'run';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['run'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'walk') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (!input._keys.shift) {
        this._parent.SetState('walk');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};

class IdleState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'idle';
  }

  Enter(prevState) {
    const idleAction = this._parent._proxy._animations['idle'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }

  Exit() {
  }

  Update(_, input) {
    if (input._keys.forward || input._keys.backward) {
      this._parent.SetState('walk');
    } else if (input._keys.space) {
      this._parent.SetState('dance');
    }
  }
};

class ThirdPersonCamera {
  constructor(params) {
    this._params = params;
    this._camera = params.camera;

    this._currentPosition = new THREE.Vector3();
    this._currentLookat = new THREE.Vector3();
  }

  _CalculateIdealOffset() {
    const idealOffset = new THREE.Vector3(-1, 30, -40);
    idealOffset.applyQuaternion(this._params.target.Rotation);
    idealOffset.add(this._params.target.Position);
    return idealOffset;
  }

  _CalculateIdealLookat() {
    const idealLookat = new THREE.Vector3(0, 10, 50);
    idealLookat.applyQuaternion(this._params.target.Rotation);
    idealLookat.add(this._params.target.Position);
    return idealLookat;
  }

  Update(timeElapsed) {
    const idealOffset = this._CalculateIdealOffset();
    const idealLookat = this._CalculateIdealLookat();

    // const t = 0.05;
    // const t = 4.0 * timeElapsed;
    const t = 1.0 - Math.pow(0.001, timeElapsed);

    this._currentPosition.lerp(idealOffset, t);
    this._currentLookat.lerp(idealLookat, t);

    this._camera.position.copy(this._currentPosition);
    this._camera.lookAt(this._currentLookat);
;
  }
} 

class ThirdPersonCameraDemo {
  constructor() {
    this._Initialize();
    this._SellerSpace();
  }
  
  _Initialize() {
    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    });
    this._threejs.outputEncoding = THREE.sRGBEncoding;
    this._threejs.shadowMap.enabled = true;
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this._threejs.setPixelRatio(window.devicePixelRatio);
    this._threejs.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this._threejs.domElement);

    window.addEventListener('resize', () => {
      this._OnWindowResize();
    }, false);
    


    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this._camera.position.set(25, 10, 25);

    this._scene = new THREE.Scene();
    camera = this._camera;

    let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    light.position.set(-100, 100, 100);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 50000;
    light.shadow.camera.right = -50000;
    light.shadow.camera.top = 50000;
    light.shadow.camera.bottom = -50000;
    this._scene.add(light);

    light = new THREE.AmbientLight(0xFFFFFF, 0.25);
    this._scene.add(light);

    light = new THREE.PointLight(0xFFFFFF, 1);
    light.position.set(0,10,0);
    this._scene.add(light);

    light = new THREE.PointLight(0xFFFFFF, 1);
    light.position.set(0,200,2200);
    this._scene.add(light);

    const targetList = [];

    const geometry = new THREE.SphereGeometry( 33, 32, 16 );
    const material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
    material.transparent = true;
    material.opacity = 0.0;

    
    document.addEventListener( 'mousedown', onDocumentMouseDown, false );
    
    // var camera = this._camera.position;
    const raycaster = new THREE.Raycaster(); // create once
    const mouse = new THREE.Vector2(); // create once
        
    function onDocumentMouseDown( event ) 
    {
    
      // update the mouse variable
      mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
      mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    
      raycaster.setFromCamera( mouse, camera );
    
      var intersects = raycaster.intersectObjects( targetList );
      
      if ( intersects.length > 0 )
      {		
          if (intersects[0].object.name === 'Sports')
          window.open('https://hub.link/B6L99L4');
          else if (intersects[0].object.name === 'TV')
          window.open('https://hub.link/Gyz6JQa');
          else if (intersects[0].object.name === 'Groceries')
          window.open('https://hub.link/s4fXU9h');
          else if (intersects[0].object.name === 'Mobiles')
          window.open('https://hub.link/ZUU6FaU');
          else if (intersects[0].object.name === 'Fashion')
          window.open('https://hub.link/uMyBSbQ');
          else if (intersects[0].object.name === 'Home')
          window.open('https://hub.link/gzuQPPa');
      } 

    
    }
    connect.then((result) => {
      console.log(result);
      result.buildings.forEach((b, index) => {
        if(index <= result.supply) {
          const boxGeometry = new THREE.BoxGeometry(b.w, b.h, b.d);
          const boxMaterial = new THREE.MeshPhongMaterial({color : (Math.random() *0x00ff00)});
          const box = new THREE.Mesh(boxGeometry, boxMaterial);
          box.position.set(b.x, b.y, b.z);
          this._scene.add(box);
        }
      });
    });
    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        './resources/clouds/bluecloud_ft.jpg',
        './resources/clouds/bluecloud_bk.jpg',
        './resources/clouds/bluecloud_up.jpg',
        './resources/clouds/bluecloud_dn.jpg',
        './resources/clouds/bluecloud_rt.jpg',
        './resources/clouds/bluecloud_lf.jpg',
    ]);
    texture.encoding = THREE.sRGBEncoding;
    this._scene.background = texture;

  
  
    // const myText = new Text()
    // myScene.add(myText)
    
    // // Set properties to configure:
    // myText.text = 'Hello world!'
    // myText.fontSize = 0.2
    // myText.position.set ( 0, 10, 5);
    // myText.color = 0x9966FF
    
    // // Update the rendering:
    // myText.sync()
   
    //ADDING GATE 
    
    const platformGeometry = new THREE.CylinderGeometry( 300, 1, 30, 120 );
    const platformMaterial = new THREE.MeshPhysicalMaterial({
  roughness: 0,
  metalness: 0,
  color: 0x000000
    });
    platformMaterial.transparent = true;
    platformMaterial.opacity = 0.2;
    platformMaterial.thickness = 0.8

    const platform = new THREE.Mesh(platformGeometry, platformMaterial)
    platform.position.set(0, -15, 0);
    // this._scene.add(platform);




    const axesHelper = new THREE.AxesHelper( 500 );
    // this._scene.add( axesHelper );


    const BiggerSpheregeometry = new THREE.SphereGeometry( 42, 32, 16 );
   
    const sphere1 = new THREE.Mesh( BiggerSpheregeometry, material );
    sphere1.position.set(140, 25, -300)
    sphere1.name = 'Fashion';
    targetList.push(sphere1);
    this._scene.add( sphere1 );
//     //ADDING PORTALS ----------
const loader1 = new GLTFLoader(LoadingManager);
loader1.load( './resources/fashion/scene.gltf', ( gltf ) => {
  gltf.scene.castShadow = true;
  gltf.scene.scale.setScalar(35);
  gltf.scene.position.set(140, 32, -300);
  model.push(gltf.scene);
  this._scene.add( gltf.scene );
  // gltf.scene.userData.name = 'Fashion';
  // gltf.scene.userData.clickable = true;


});

const FashionLoader = new THREE.TextureLoader().load(
  './resources/Texts/Fashion.png'
);
const fashion = new THREE.Mesh(

new THREE.PlaneGeometry(305, 105, 1, 1),
new THREE.MeshStandardMaterial({
  map: FashionLoader
}));
fashion.castShadow = false;
fashion.receiveShadow = true;
fashion.rotation.y = Math.PI / 2;

fashion.rotation.y= -88.28;
fashion.position.set(140, 70, -300)
this._scene.add(fashion);

const Mobilespheregeometry = new THREE.BoxGeometry( 62, 62, 62 );

const sphere2 = new THREE.Mesh( Mobilespheregeometry, material );
sphere2.position.set(-290, 28, 40)
sphere2.name = 'Mobiles';
targetList.push(sphere2);
this._scene.add( sphere2 );


const loader2 = new GLTFLoader(LoadingManager);
loader2.load( './resources/Mobile Phones/scene.gltf', ( gltf ) => {
  gltf.scene.castShadow = true;
  gltf.scene.scale.setScalar(28);
  gltf.scene.position.set(-290, 28, 40);
  // gltf.scene.rotation.set( 0, 0.4, 0 )
  var Mobile=gltf.scene;
  this._scene.add( Mobile);
  // Mobile.userData.name = 'Mobile';
  // gltf.scene.userData.clickable = true;


});

const MobileLoader = new THREE.TextureLoader().load(
  './resources/Texts/Mobile.png'
);
const plane = new THREE.Mesh(

new THREE.PlaneGeometry(305, 105, 1, 1),
new THREE.MeshStandardMaterial({
  map: MobileLoader
}));
plane.castShadow = false;
plane.receiveShadow = true;
plane.rotation.y = Math.PI / 2;

// plane.rotation.z = -Math.PI / 2;
plane.position.set(-300, 70, 30)
this._scene.add(plane);


const sphere3 = new THREE.Mesh( geometry, material );
sphere3.position.set(300, 25, 0)
sphere3.name = 'Home';
targetList.push(sphere3);
this._scene.add( sphere3 );



const loader3 = new GLTFLoader(LoadingManager);
loader3.load( './resources/home & furniture/scene.gltf', ( gltf ) => {
  gltf.scene.castShadow = true;
  gltf.scene.scale.setScalar(2-40);
  gltf.scene.position.set(300, 25, 0);
  this._scene.add( gltf.scene );
  // gltf.scene.userData.name = 'Home';
  // gltf.scene.userData.clickable = true;


});
const HomeLoader = new THREE.TextureLoader().load(
  './resources/Texts/Home.png'
);
const home = new THREE.Mesh(

new THREE.PlaneGeometry(305, 105, 1, 1),
new THREE.MeshStandardMaterial({
  map: HomeLoader
}));
home.castShadow = false;
home.receiveShadow = true;
home.rotation.y = Math.PI / 2;

// home.rotation.x = Math.PI ;
// home.rotation.y = Math.PI ;
home.rotation.y = 3*Math.PI/2 ;

home.position.set(300, 70, 0)
this._scene.add(home);


// //ADDING CLICKABLE SPHERE

const sphere4 = new THREE.Mesh( geometry, material );
    sphere4.position.set(140, 25, 270)
    sphere4.name = 'Sports';
    targetList.push(sphere4);
    this._scene.add( sphere4 );

const loader4 = new GLTFLoader(LoadingManager);

//Adding Sphere gltf
loader4.load( './resources/sports/scene.gltf', ( gltf ) => {
  gltf.scene.castShadow = true;
  gltf.scene.scale.setScalar(30);
  gltf.scene.position.set(140, 25, 270);
  gltf.scene.rotateY(0.04);
  this._scene.add( gltf.scene );
  // loader4.userData.name = 'Sports';
// loader4.userData.clickable = true;
    
});

//dding Sports Billboard
const sportsLoader = new THREE.TextureLoader().load(
  './resources/Texts/Sports.png'
);
const sports = new THREE.Mesh(

new THREE.PlaneGeometry(305, 105, 1, 1),
new THREE.MeshStandardMaterial({
  map: sportsLoader
}));
sports.castShadow = false;
sports.receiveShadow = true;
sports.rotation.y = 450;

// sports.rotation.y = Math.PI;
sports.position.set(140, 70, 270)
this._scene.add(sports);


const sphere5 = new THREE.Mesh( geometry, material );
sphere5.position.set(-170, 20, 270)
sphere5.name = 'TV';
targetList.push(sphere5);
this._scene.add( sphere5 );

const loader5 = new GLTFLoader(LoadingManager);
loader5.load( './resources/tv & appliances/scene.gltf', ( gltf ) => {
  gltf.scene.castShadow = true;
  gltf.scene.scale.setScalar(2);
  gltf.scene.position.set(-170, 20, 270);
  this._scene.add( gltf.scene );
  // gltf.scene.userData.name = 'TV';
  // gltf.scene.userData.clickable = true;

});
const tvLoader = new THREE.TextureLoader().load(
  './resources/Texts/TV.png'
);
const tv = new THREE.Mesh(

new THREE.PlaneGeometry(305, 105, 1, 1),
new THREE.MeshStandardMaterial({
  map: tvLoader
}));
tv.castShadow = false;
tv.receiveShadow = true;
tv.rotation.y = Math.PI / 2;

tv.rotation.y = 184.8;
tv.position.set(-170, 70, 270)
this._scene.add(tv);

const sphere6 = new THREE.Mesh( BiggerSpheregeometry, material );
sphere6.position.set(-160, 34, -250)
sphere6.name = 'Groceries';
targetList.push(sphere6);
this._scene.add( sphere6 );

const loader6 = new GLTFLoader(LoadingManager);
loader6.load( './resources/groceries/scene.gltf', ( gltf ) => {
  gltf.scene.castShadow = true;
  gltf.scene.scale.setScalar(0.4);
  gltf.scene.position.set(-160, 34, -250);
  this._scene.add( gltf.scene );
  // gltf.scene.userData.name = 'Groceries';
  // gltf.scene.userData.clickable = true;


});
const groceriesLoader = new THREE.TextureLoader().load(
  './resources/Texts/Groceries.png'
);
const groceries = new THREE.Mesh(

new THREE.PlaneGeometry(305, 95, 1, 1),
new THREE.MeshStandardMaterial({
  map: groceriesLoader
}));
groceries.castShadow = false;
groceries.receiveShadow = true;
groceries.rotation.y = Math.PI / 2;

groceries.rotation.y = 44.8;
groceries.position.set(-160, 75, -250)
this._scene.add(groceries);
//FINISHED ADDING PORTALS
//ADDING CLICKABLE SPHERE

// create an AudioListener and add it to the camera
const listener = new THREE.AudioListener();
this._camera.add( listener );

// create a global audio source
const sound1 = new THREE.PositionalAudio( listener );

// load a sound and set it as the Audio object's buffer
const audioLoader1 = new THREE.AudioLoader();
audioLoader1.load( './resources/bgmusic.mp3', function( buffer ) {
	sound1.setBuffer( buffer );
	sound1.setLoop(true);
	sound1.setVolume(0.5);
  sound1.setRefDistance(100);
  sound1.resume();
	sound1.play();
});
const ssphere = new THREE.CylinderGeometry( 15, 15, 2, 100 );
const smaterial = new THREE.MeshPhongMaterial( { color: 0x000000 } );
const speaker1 = new THREE.Mesh( ssphere, smaterial );
this._scene.add( speaker1 );
speaker1.position.set(0, -1, 0);
// finally add the sound to the mesh
speaker1.add( sound1 );

const sound2 = new THREE.PositionalAudio( listener );

// load a sound and set it as the Audio object's buffer
const audioLoader2 = new THREE.AudioLoader();
audioLoader2.load( './resources/bgmusic2.mp3', function( buffer ) {
	sound2.setBuffer( buffer );
	sound2.setLoop(true);
	sound2.setVolume(0.5);
  sound2.setRefDistance(80);
	sound2.play();
});
// const speaker2geo = new THREE.CylinderGeometry( 15, 15, 2, 100 );
// const smaterial = new THREE.MeshPhongMaterial( { color: 0x000000 } );
const speaker2 = new THREE.Mesh( ssphere, smaterial );
this._scene.add( speaker2 );
speaker2.position.set(0, -1, 1600);
speaker2.add( sound2 );





    this._mixers = [];
    this._previousRAF = null;

    this._LoadAnimatedModel();
    this._RAF();
  }

  
  _SellerSpace() {

    const groundgeometry = new THREE.BoxGeometry( 1000, 0.1, 1000 );
    const groundmaterial = new THREE.MeshPhongMaterial( { color: 0x000000 } );
    const cube = new THREE.Mesh( groundgeometry, groundmaterial );
    cube.position.set(0, 0, 1600);
    this._scene.add( cube );

    const roadgeometry = new THREE.BoxGeometry( 1200, 0.1, 30 );
    // const material = new THREE.MeshBasicMaterial( { color: 0x000000 } );
    const road = new THREE.Mesh( roadgeometry, groundmaterial );
    road.position.set(0, 0, 600);
    road.rotation.y=-Math.PI/2;
    this._scene.add( road );

    // const boxGeometry = new THREE.BoxGeometry(200, 400, 200);
    // const boxMaterial = new THREE.MeshPhongMaterial({color : 0x00ff00});
    // const box = new THREE.Mesh(boxGeometry, boxMaterial);
    // box.position.set(0, 0, 2000);
    // this._scene.add(box);


  }
  _LoadAnimatedModel() {
    const params = {
      camera: this._camera,
      scene: this._scene,
    }
    this._controls = new BasicCharacterController(params);

    this._thirdPersonCamera = new ThirdPersonCamera({
      camera: this._camera,
      target: this._controls,
    });
  }

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._RAF();

      // if (model) console.log(model[0]);
      this._threejs.render(this._scene, this._camera);
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }

  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this._mixers) {
      this._mixers.map(m => m.update(timeElapsedS));
    }

    if (this._controls) {
      this._controls.Update(timeElapsedS);
    }

    this._thirdPersonCamera.Update(timeElapsedS);
  }
}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new ThirdPersonCameraDemo();
});


function _LerpOverFrames(frames, t) {
  const s = new THREE.Vector3(0, 0, 0);
  const e = new THREE.Vector3(100, 0, 0);
  const c = s.clone();

  for (let i = 0; i < frames; i++) {
    c.lerp(e, t);
  }
  return c;
}

function _TestLerp(t1, t2) {
  const v1 = _LerpOverFrames(100, t1);
  const v2 = _LerpOverFrames(50, t2);
  // console.log(v1.x + ' | ' + v2.x);
}

_TestLerp(0.01, 0.01);
_TestLerp(1.0 / 100.0, 1.0 / 50.0);
_TestLerp(1.0 - Math.pow(0.3, 1.0 / 100.0), 
          1.0 - Math.pow(0.3, 1.0 / 50.0));

          
