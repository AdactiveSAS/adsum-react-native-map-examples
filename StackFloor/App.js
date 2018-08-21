import React from 'react';
import {
  StyleSheet,
  WebView,
  Platform,
  View,
  ToolbarAndroid,
  Button,
  Text,
  ActionSheetIOS
} from 'react-native';
import {
  AdsumNativeMap,
  MOUSE_EVENTS,
  StackFloorAnimationOptions,
} from '@adactive/adsum-react-native-map';
import {EntityManager} from '@adactive/adsum-client-api';

export default class App extends React.Component {
  constructor() {
    super();

    this.state = {
      ready: false,
      instruction: null,
    };

    this.floorTitles = new Map();
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
      })
    );

    this.setState({ready: true});
  }

  async changeFloor(floor) {
    await this.adsumRnMap.sceneManager.setCurrentFloor(floor);
    await this.adsumRnMap.cameraManager.centerOnFloor(floor);
  }

  render() {
    return (
      <View style={styles.container}>
        {this.renderToolbar()}
        {this.renderWebView()}
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
  }
});
