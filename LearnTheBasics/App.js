import React from 'react';
import {StyleSheet, WebView, Platform, View, ToolbarAndroid, Button, Text, ActionSheetIOS} from 'react-native';
import {AdsumNativeMap, MOUSE_EVENTS, Path} from '@adactive/adsum-react-native-map';
import {EntityManager} from '@adactive/adsum-client-api';

export default class App extends React.Component {
    constructor() {
        super();

        this.state = {
            ready: false,
        };

        this.selection = {
            locked: false,
            current: null,
        };

        this.floorTitles = new Map();

        this.currentPath = null;
    }

    componentWillMount() {
        // Create an entityManager using the API credentials (see AdsumClientAPI documentation for more details)
        this.entityManager = new EntityManager({
            "endpoint": "https://api.adsum.io",
            "site": 322,
            "username": "323-device",
            "key": "343169bf805f8abd5fa71a4f529594a654de6afbac70a2d867a8b458c526fb7d"
        });

        // Create the Map instance
        this.adsumRnMap = new AdsumNativeMap({});

        this.start();
    }

    async start() {
        // Init the Map
        await this.adsumRnMap.init({
            entityManager: this.entityManager,
            deviceId: 323,
        });

        // Start the rendering
        await this.adsumRnMap.start();

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

        // Register mouse listener events
        this.adsumRnMap.mouseManager.addEventListener(MOUSE_EVENTS.click, this.onMapClick.bind(this));
        this.adsumRnMap.mouseManager.addEventListener(MOUSE_EVENTS.dblClick, this.onMapDblClick.bind(this));
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
        // Toolbar is platform specific !

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

        if (this.state.ready) {
            // If ready, then add the possible actions

            // Add the Site case (changeFloor(null))
            actions.push({title: 'Site'});
            floors.push(null);

            // For each floor add the action
            this.adsumRnMap.objectManager.floors.forEach((floor) => {
                actions.push({title: this.floorTitles.get(floor) });
                floors.push(floor);
            });
        }

        return (
            <ToolbarAndroid
                title="Learn the Basics"
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
        if (this.state.ready) {
            // Add btn only if the map is ready
            btn = (<Button
                onPress={this.toggleFloorsIOS.bind(this)}
                style={styles.titleText}
                title="Change floor"
            />);
        }

        return (
            <View style={styles.toolbarIOS}>
                <Text style={styles.titleText}>Learn the Basics</Text>
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
                const floor = floors[index];
                this.changeFloor(floor);
            },
        );
    }

    async changeFloor(floor) {
        // First change the floor
        await this.adsumRnMap.sceneManager.setCurrentFloor(floor);

        // Don't forget to center the camera on floor !
        await this.adsumRnMap.cameraManager.centerOnFloor(floor);
    }

    async onMapClick({intersects}) {
        // intersects is an array of intersected objects on the click location
        // intersects will be sort by deep in order

        if (intersects.length === 0) {
            await this.updateSelection(null);
            return;
        }

        const firstIntersect = intersects[0];
        if (firstIntersect.object.isBuilding || firstIntersect.object.isSpace) {
            await this.updateSelection(firstIntersect.object);
        } else if (firstIntersect.object.isLabel) {
            // Special label behavior !! getParent is async !!
            const labelParent = await firstIntersect.object.getParent();
            if (labelParent.isBuilding || labelParent.isSpace) {
                // Prefer select the parent
                await this.updateSelection(labelParent);
            } else {
                await this.updateSelection(firstIntersect.object);
            }
        } else {
            await this.updateSelection(null);
        }
    }

    async onMapDblClick({intersects}) {
        // intersects is an array of intersected objects on the dblClick location
        // intersects will be sort by deep in order

        if (intersects.length > 0) {
            this.selection.locked = true;

            const firstIntersect = intersects[0];
            if (firstIntersect.object.isSite) {
                await this.changeFloor(null);
            } else if (firstIntersect.object.isFloor) {
                await this.changeFloor(firstIntersect.object);
            }

            this.selection.locked = false;
        }
    }

    async updateSelection(object) {
        // Do nothing if it's already selected
        if (this.selection.locked || object === this.selection.current) {
            return;
        }

        this.selection.locked = true;

        // Make sure to unselect previously selected
        if (this.selection.current !== null && this.selection.current.isBuilding) {
            await this.resetBuilding(this.selection.current);
        } else if (this.selection.current !== null && this.selection.current.isSpace) {
            await this.resetSpace(this.selection.current);
        } else if (this.selection.current !== null && this.selection.current.isLabel) {
            await this.resetLabel(this.selection.current);
        }

        this.selection.current = object;

        if (this.selection.current !== null && this.selection.current.isBuilding) {
            await this.highlightBuilding(this.selection.current);
        } else if (this.selection.current !== null && this.selection.current.isSpace) {
            await this.highlightSpace(this.selection.current);
        } else if (this.selection.current !== null && this.selection.current.isLabel) {
            await this.highlightLabel(this.selection.current);
        }

        this.selection.locked = false;
    }

    async highlightBuilding(building) {
        await this.adsumRnMap.cameraManager.centerOn(building);

        await building.setColor(0x78e08f);
        const labels = await building.getLabels();
        await Promise.all(labels.map(labelObject => labelObject.select()));
    }

    async resetBuilding(building) {
        await building.resetColor();

        const labels = await building.getLabels();
        await Promise.all(labels.map(labelObject => labelObject.unselect()));
    }

    async highlightSpace(space) {
        await this.adsumRnMap.cameraManager.centerOn(space);
        await space.setColor(0x78e08f);
        await space.bounceUp(3);

        const labels = await space.getLabels();
        await Promise.all(labels.map(labelObject => labelObject.select()));

        await this.goTo(space);
    }

    async highlightLabel(label) {
        await label.select();
        await this.adsumRnMap.cameraManager.centerOn(label);
        await this.goTo(space);
    }

    async resetSpace(space) {
        await space.resetColor();
        await space.bounceDown();

        const labels = await space.getLabels();
        await Promise.all(labels.map(labelObject => labelObject.unselect()));
    }

    async resetLabel(label) {
        return label.unselect();
    }

    async goTo(object) {
        if (this.currentPath !== null) {
            // Remove previously drawn paths
            await this.adsumRnMap.wayfindingManager.removePath(this.currentPath);
        }

        // Get the object location
        const placeId = await object.getPlaceId();
        const location = await this.adsumRnMap.wayfindingManager.locationRepository.get(placeId);

        // Create path from user location (null) and object location
        this.currentPath = new Path(null, location);

        // Compute the path to find the shortest path
        await this.adsumRnMap.wayfindingManager.computePath(this.currentPath);

        for(const pathSection of this.currentPath.getPathSections()) {
            // Do the floor change
            await this.changeFloor(pathSection.ground.isFloor ? pathSection.ground : null);

            // Draw the step
            await this.adsumRnMap.wayfindingManager.drawPathSection(pathSection);

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
            await Promise.all(labelObjects.map(labelObject => labelObject.select()));

            // Add a delay of 1.5 seconds
            await new Promise((resolve) => {
                setTimeout(resolve, 1500);
            });

            // unselect label objects
            await Promise.all(labelObjects.map(labelObject => labelObject.unselect()));
        }
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
});