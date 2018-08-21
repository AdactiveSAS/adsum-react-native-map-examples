import React from 'react';
import {
  StyleSheet,
  WebView,
  Platform,
  NativeEventEmitter,
  View,
  ToolbarAndroid,
  Button,
  Text,
  ActionSheetIOS,
  TouchableWithoutFeedback
} from 'react-native';
import {
  AdsumNativeMap,
  MOUSE_EVENTS,
  StackFloorAnimationOptions,
  WAYFINDING_EVENTS,
  Path,
  DotPathBuilderOptions,
  ArrowPathPatternOptions,
  DotPathSectionDrawerOptions,
  CameraCenterOnOptions,
  OrientedDotUserObjectOptions,
} from '@adactive/adsum-react-native-map';
import {EntityManager} from '@adactive/adsum-client-api';
import ReactNativeHeading from '@zsajjad/react-native-heading';
import Icon from 'react-native-vector-icons/FontAwesome';

class CancelError extends Error {
  constructor() {
    super('Path cancelled');

    this.isCancelError = true;
  }
}

export default class App extends React.Component {
  constructor() {
    super();

    this.state = {
      ready: false,
      locked: false,
      heading: null,
      compass: false,
      hasCompass: false,
      instruction: null,
    };

    this.floorTitles = new Map();

    this.path = null;
    this.space = null;
    this.labels = new Set();

    this.headingListener = null;

    this.pathNeedRedraw = false;
    this.currentPathSection = null;
    this.onUserCompletedPathSection = null;
    this.onUserCancel = null;
  }

  componentWillMount() {
    // Create an entityManager using the API credentials (see AdsumClientAPI documentation for more details)
    this.entityManager = new EntityManager({
      "endpoint": "https://api.adsum.io",
      "site": 477,
      "username": "896-device",
      "key": "34480ca3a5ded1e92b6be9da4b6583f7b8657e65bbb66840feb3238376fbe413"
    });

    // Create the Map instance
    this.adsumRnMap = new AdsumNativeMap({
      scene: {
        animation: new StackFloorAnimationOptions(),
      },
      wayfinding: {
        pathBuilder: new DotPathBuilderOptions({
          patternSpace: 6,
          patternSize: 1.5,
          pattern: new ArrowPathPatternOptions({
            color: 0xffa502
          })
        }),
        pathSectionDrawer: new DotPathSectionDrawerOptions({
          centerOnOptions: new CameraCenterOnOptions({
            altitude: 80,
            fitRatio: 1.5,
            time: 1500,
            zoom: true,
          }),
          oriented: true,
          speed: 20,
        }),
        userObject: new OrientedDotUserObjectOptions({
          size: 4,
          color: 0xff4757,
        }),
      }
    });

    this.start();
  }

  async start() {
    // Init the Map
    await this.adsumRnMap.init({
      entityManager: this.entityManager,
      deviceId: 896,
    });

    // Start the rendering
    await this.adsumRnMap.start();

    // Create floor name mapping
    const floors = Array.from(this.adsumRnMap.objectManager.floors.values());
    await Promise.all(
      floors.map(async (floor) => {
        const floorName = await floor.getName();
        const building = await floor.getBuilding();
        const buildingName = await building.getName();
        this.floorTitles.set(floor, `${buildingName}-${floorName}`);
      }),
    );

    this.setState({ready: true});

    // Listen map events
    this.adsumRnMap.mouseManager.addEventListener(MOUSE_EVENTS.click, this.onMapClick.bind(this));

    this.headingListener = new NativeEventEmitter(ReactNativeHeading);
    ReactNativeHeading.start(0.1).then(didStart => {
      if (!didStart) {
        console.warn('Cannot retrieve heading, this device doesn\'t seem to have a magnetometer.');
      }

      this.setState({ hasCompass: didStart });
    });

    this.headingListener.addListener('headingUpdated', this.onHeadingChanged.bind(this));

    this.adsumRnMap.mouseManager.addEventListener(MOUSE_EVENTS.dblClick, this.onMapDblClick.bind(this));
    this.adsumRnMap.wayfindingManager.addEventListener(
      WAYFINDING_EVENTS.user.position.didChanged,
      this.onUserPositionUpdated.bind(this),
    );
  }

  async changeFloor(floor) {
    await this.adsumRnMap.sceneManager.setCurrentFloor(floor);
    await this.adsumRnMap.cameraManager.centerOnFloor(floor);
  }

  onHeadingChanged(heading) {
    if (!this.state.locked && this.state.compass) {
      // Don't animate as this method is called multiple time per seconds
      this.adsumRnMap.cameraManager.move({azimuth: heading}, false);
    }

    this.setState({heading});
    this.adsumRnMap.wayfindingManager.setUserAzimuthHeading(heading);
  }

  componentWillUnmount() {
    ReactNativeHeading.stop();
    this.headingListener.removeAllListeners('headingUpdated');
    this.headingListener = null;
  }

  async onMapClick({intersects}) {
    // intersects is an array of intersected objects on the click location
    // intersects will be sort by deep in order

    if (intersects.length === 0) {
      return;
    }

    const firstIntersect = intersects[0];
    if (firstIntersect.object.isSpace) {
      await this.goTo(firstIntersect.object);
    } else if (firstIntersect.object.isLabel) {
      // Special label behavior !! getParent is async !!
      const labelParent = await firstIntersect.object.getParent();
      if (labelParent.isSpace) {
        // Prefer select the parent
        await this.goTo(labelParent);
      }
    }
  }

  async onMapDblClick({intersects}) {
    // intersects is an array of intersected objects on the dblClick location
    // intersects will be sort by deep in order

    if (intersects.length > 0) {
      const firstIntersect = intersects[0];
      if (firstIntersect.object.isSite) {
        await this.adsumRnMap.wayfindingManager.setUserAdsumPosition(firstIntersect.position, null);
      } else if (firstIntersect.object.isFloor) {
        await this.adsumRnMap.wayfindingManager.setUserAdsumPosition(
          firstIntersect.position,
          firstIntersect.object,
        );
      }
    }
  }

  async goTo(space) {
    if (this.state.locked) {
      return;
    }

    try {
      this.setState({locked: true});

      await this.removeGoToArtifacts();

      await this.selectSpace(space);

      // Center on the selected space, with a zoom
      await this.adsumRnMap.cameraManager.centerOn(space, true, { zoom: true, fitRatio: 2 });

      await this.wait(500);

      // Get the object location
      const placeId = await this.space.getPlaceId();
      const location = await this.adsumRnMap.wayfindingManager.locationRepository.get(placeId);
      // Create path from user location (null) and object location
      this.path = new Path(null, location);

      // Compute the path to find the shortest path
      await this.adsumRnMap.wayfindingManager.computePath(this.path);

      // Get path sections, including inter-ground ones
      const pathSections = this.path.getPathSections(true);

      // Change floor if needed
      const isOnStartingFloor = await this.adsumRnMap.sceneManager.isCurrentFloor(pathSections[0].ground);
      if (!isOnStartingFloor) {
        await this.adsumRnMap.sceneManager.setCurrentFloor(pathSections[0].ground);
        await this.wait(500);
      }

      for (const pathSection of pathSections) {
        await this.drawPathSection(pathSection);
      }

      const centerOptions = {altitude: 45};
      if (this.state.compass) {
        centerOptions.azimuth = this.state.heading;
      }
      await this.adsumRnMap.cameraManager.move(centerOptions);
    } catch (e) {
      if (!e.isCancelError) {
        console.error(e);
      }
    } finally {
      this.setState({locked: false}, () => {
        if (this.pathNeedRedraw) {
          this.pathNeedRedraw = false;
          this.goTo(space);
        }
      });
    }
  }

  async drawPathSection(pathSection) {
    // If a user is not following the path, throw CancelError
    this.cancelIfNeedRedraw();

    // If it's inter-ground path section, then floor changed is required
    if (pathSection.isInterGround()) {
      await this.wait(1500);
      await this.adsumRnMap.sceneManager.setCurrentFloor(pathSection.getLastGround());

      return;
    }

    await this.adsumRnMap.wayfindingManager.drawPathSection(pathSection);

    // If a user is not following the path, throw CancelError
    this.cancelIfNeedRedraw();

    // Find any attached labelObjects to the pathSection destination
    let labelObjects = [];
    let adsumObject = await this.adsumRnMap.objectManager.getByAdsumLocation(pathSection.to);
    if (adsumObject !== null) {
      if (adsumObject.isLabel) {
        labelObjects = [adsumObject];
      } else if (adsumObject.isBuilding || adsumObject.isSpace) {
        labelObjects = await adsumObject.getLabels();
      }
    }

    // Select label objects
    await Promise.all(
      labelObjects.map((labelObject) => {
        this.labels.add(labelObject);

        return labelObject.select();
      }),
    );

    // If a user is not following the path, throw CancelError
    this.cancelIfNeedRedraw();

    await this.waitUserCompletePathSection(pathSection);
  }

  async removeGoToArtifacts() {
    // Remove previous path, if any
    if (this.path !== null) {
      await this.adsumRnMap.wayfindingManager.removePath(this.path);
      this.path = null;
    }

    // Unselect previous space, if any
    if (this.space !== null) {
      await Promise.all([
        this.space.resetColor(),
        this.space.bounceDown(),
        await Promise.all(
          Array.from(this.labels).map(labelObject => {
            this.labels.delete(labelObject);
            return labelObject.unselect()
          }),
        ),
      ]);
    }
  }

  async selectSpace(space) {
    this.space = space;
    const labels = await this.space.getLabels();

    // Change the color & bounce the destination space to put it in evidence
    await Promise.all([
      this.space.setColor(0x78e08f),
      this.space.bounceUp(3),
      await Promise.all(
        Array.from(labels).map(labelObject => {
          this.labels.add(labelObject);
          return labelObject.select()
        }),
      ),
    ]);
  }

  cancelIfNeedRedraw() {
    if (this.pathNeedRedraw) {
      throw new CancelError();
    }
  }

  async wait(time) {
    return new Promise((resolve) => {
      setTimeout(resolve, time);
    });
  }

  async waitUserCompletePathSection(pathSection) {
    return new Promise((resolve, reject) => {
      this.setState({instruction: 'DblClick to Move'});

      this.currentPathSection = pathSection;
      this.onUserCompletedPathSection = resolve;
      this.onUserCancel = reject;
    });
  }

  async onUserPositionUpdated() {
    if (this.currentPathSection === null) {
      return;
    }

    const progress = await this.adsumRnMap.wayfindingManager.getUserPathSectionProgress(this.currentPathSection);

    // Does the user is still following the path section ?
    if (progress.distanceFromPathSection > 10) {
      this.pathNeedRedraw = true;

      if (this.onUserCancel !== null) {
        this.onUserCancel(new CancelError());
        this.onUserCancel = null;
      }
    }

    if (this.onUserCompletedPathSection === null) {
      // We are not waiting for the path to be complete
      return;
    }

    const distanceToEnd = (1 - progress.progress) * this.currentPathSection.getDistance();

    if (distanceToEnd < 10) {
      this.onUserCompletedPathSection();
      this.onUserCompletedPathSection = null;
    }
  }

  render() {
    return (
      <View style={styles.container}>
        {this.renderToolbar()}
        {this.renderWebView()}
        {this.renderCompass()}
        {this.renderUserBtn()}
      </View>
    );
  }

  renderWebView() {
    return (
      <WebView style={styles.webview} {...this.adsumRnMap.getWebViewProps()}>

      </WebView>
    );
  }

  renderToolbar() {
    if (Platform.OS === 'android') {
      return this.renderToolbarAndroid();
    }

    if (Platform.OS === 'ios') {
      return this.renderToolbarIOS();
    }

    return null;
  }

  renderToolbarAndroid() {
    const actions = []; // The actions to display in the toolbar
    const floors = []; // The floors to select, in the same order than actions

    if (this.state.ready && !this.state.locked) {
      // If ready, then add the possible actions

      // Add the Site case
      actions.push({title: 'Site'});
      floors.push(null);

      // For each floor add the action
      this.adsumRnMap.objectManager.floors.forEach((floor) => {
        actions.push({title: this.floorTitles.get(floor)});
        floors.push(floor);
      });
    }

    return (
      <ToolbarAndroid
        title={this.state.instruction === null ? "Stack Floor" : this.state.instruction }
        actions={actions}
        onActionSelected={(index) => {
          this.changeFloor(floors[index]);
        }}
        style={styles.toolbarAndroid}
      />
    );
  }

  renderToolbarIOS() {
    let btn = null;
    if (this.state.ready && !this.state.locked) {
      // Add btn only if the map is ready
      btn = (<Button
        onPress={this.toggleFloorsIOS.bind(this)}
        style={styles.titleText}
        title="Change floor"
      />);
    }

    return (
      <View style={styles.toolbarIOS}>
        <Text style={styles.titleText}>
          {this.state.instruction === null ? "Stack Floor" : this.state.instruction }
        </Text>
        {btn}
      </View>
    );
  }

  toggleFloorsIOS() {
    const options = ['Site'];
    const floors = [null];

    this.adsumRnMap.objectManager.floors.forEach((floor) => {
      options.push(this.floorTitles.get(floor));
      floors.push(floor);
    });
    options.push('Cancel');

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
      },
      (index) => {
        if (index < floors.length) {
          const floor = floors[index];
          this.changeFloor(floor);
        }
      },
    );
  }

  renderUserBtn() {
    if (! this.state.ready || this.state.locked) {
      return null;
    }

    return (
      <TouchableWithoutFeedback onPress={async () => {
        this.setState({ locked: true });

        try {
          const { user } = this.adsumRnMap.objectManager;
          const userGround = await user.getParent();
          const isUserOnCurrentFloor = await this.adsumRnMap.sceneManager.isCurrentFloor(
            userGround,
          );

          if (!isUserOnCurrentFloor) {
            await this.adsumRnMap.sceneManager.setCurrentFloor(userGround);
          }

          await this.adsumRnMap.cameraManager.centerOn(
            user,
            true,
            {
              zoom: true,
              fitRatio: 5,
              azimuth: this.state.heading,
            },
          );
        } catch( e) {
          console.error(e);
        } finally {
          this.setState({ locked: false });
        }
      }}>
        <View style={styles.btnUser}>
          <Icon name="crosshairs"
                size={30}
                style={{textAlign: 'center', lineHeight: 50}}
                color={this.state.locked ? "#70a1ff" : "#5352ed"}
          />
        </View>
      </TouchableWithoutFeedback>
    );
  }

  renderCompass() {
    if (! this.state.hasCompass || ! this.state.ready || this.state.locked) {
      return null;
    }

    return (
      <TouchableWithoutFeedback onPress={async () => {
        await this.adsumRnMap.cameraManager.move({ azimuth: this.state.heading }, true);
        this.setState({ compass: !this.state.compass })
      }}>
        <View style={styles.btnCompass}>
          <Icon name="compass"
                size={30}
                style={{textAlign: 'center', lineHeight: 50}}
                color={this.state.compass ? "#70a1ff" : "#5352ed"}
          />
        </View>
      </TouchableWithoutFeedback>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  toolbarAndroid: {
    backgroundColor: 'rgba(200,200,200,0.2)',
    height: 56,
  },
  toolbarIOS: {
    marginTop: 20,
    alignItems: 'center',
  },
  webview: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    color: '#000000',
    alignItems: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  btnUser: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    zIndex: 10,
    borderRadius: 25,
    borderColor: '#747d8c',
    borderWidth: 1,
    backgroundColor: "#dfe4ea",
    width: 52,
    height: 52,
  },
  btnCompass: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    zIndex: 10,
    borderRadius: 25,
    borderColor: '#747d8c',
    borderWidth: 1,
    backgroundColor: "#dfe4ea",
    width: 52,
    height: 52,
  },
});
