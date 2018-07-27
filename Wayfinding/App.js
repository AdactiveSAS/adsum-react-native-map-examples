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
    WAYFINDING_EVENTS,
    Path,
    DotPathBuilderOptions,
    ArrowPathPatternOptions,
    DotPathSectionDrawerOptions,
    CameraCenterOnOptions,
    OrientedDotUserObjectOptions,
    UserPositionUpdateOptions
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
            interactive: true,
        };

        this.headingListener = null;

        this.floorTitles = new Map();

        this.path = null;
        this.pathNeedRedraw = false;
        this.currentPathSection = null;
        this.onUserCompletedPathSection = null;
        this.onUserCancel = null;
        this.space = null;
        this.labels = new Set();
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
        this.adsumRnMap = new AdsumNativeMap({
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
                userPositionUpdateOptions: new UserPositionUpdateOptions({
                    animated: true,
                    duration: 400,
                }),
            }
        });

        this.start();
    }

    async start() {
        // Init the Map
        await this.adsumRnMap.init({
            entityManager: this.entityManager,
            deviceId: 323,

            // "deviceId": 1064
        });

        // Start the rendering
        await this.adsumRnMap.start();

        this.headingListener = new NativeEventEmitter(ReactNativeHeading);
        ReactNativeHeading.start(0.1).then(didStart => {
            if (!didStart) {
                console.warn('Cannot retrieve heading, this device doesn\'t seem to have a magnetometer.');
            }

            this.setState({ hasCompass: didStart });
        });


        this.headingListener.addListener('headingUpdated', heading => {
            if (!this.state.locked && this.state.compass) {
                this.adsumRnMap.cameraManager.move({azimuth: heading}, false);
            }

            this.setState({heading});
            this.adsumRnMap.wayfindingManager.setUserAzimuthHeading(heading);
        });

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

        this.adsumRnMap.mouseManager.addEventListener(MOUSE_EVENTS.click, this.onMapClick.bind(this));
        this.adsumRnMap.mouseManager.addEventListener(MOUSE_EVENTS.dblClick, this.onMapDblClick.bind(this));
        this.adsumRnMap.wayfindingManager.addEventListener(
            WAYFINDING_EVENTS.user.position.didChanged,
            this.onUserPositionUpdated.bind(this),
        );
    }

    componentWillUnmount() {
        ReactNativeHeading.stop();
        this.headingListener.removeAllListeners('headingUpdated');
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

            if (this.path !== null) {
                await this.adsumRnMap.wayfindingManager.removePath(this.path);
                this.path = null;
            }

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

            this.space = space;
            const labels = await this.space.getLabels();

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

            await this.adsumRnMap.cameraManager.centerOn(space, true, {zoom: true, fitRatio: 2});

            await this.wait(500);

            // Get the object location
            const placeId = await this.space.getPlaceId();
            const location = await this.adsumRnMap.wayfindingManager.locationRepository.get(placeId);

            // Create path from user location (null) and object location
            this.path = new Path(null, location);

            // Compute the path to find the shortest path
            await this.adsumRnMap.wayfindingManager.computePath(this.path);

            const pathSections = this.path.getPathSections(true);

            const isOnStartingFloor = await this.adsumRnMap.sceneManager.isCurrentFloor(pathSections[0].ground);
            if (!isOnStartingFloor) {
                await this.adsumRnMap.sceneManager.setCurrentFloor(pathSections[0].ground);
                await this.wait(500);
            }

            for (const pathSection of pathSections) {
                this.cancelIfNeedRedraw();

                if (pathSection.isInterGround()) {
                    await this.wait(1500);
                    await this.adsumRnMap.sceneManager.setCurrentFloor(pathSection.getLastGround());

                    continue;
                }

                await this.adsumRnMap.wayfindingManager.drawPathSection(pathSection);

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

                this.cancelIfNeedRedraw();

                await this.waitUserCompletePathSection(pathSection);
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

        if (progress.distanceFromPathSection > 10) {
            this.pathNeedRedraw = true;

            if (this.onUserCancel !== null) {
                this.onUserCancel(new CancelError());
                this.onUserCancel = null;
            }
        }

        if (this.onUserCompletedPathSection === null) {
            return;
        }

        const distanceToEnd = (1 - progress.progress) * this.currentPathSection.getDistance();

        console.log(progress, distanceToEnd);

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
                {this.renderUserBtn()}
                {this.renderCompass()}
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

            // Add the Site case (changeFloor(null))
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
                title={this.state.instruction === null ? "Wayfinding" : this.state.instruction }
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
                    {this.state.instruction === null ? "Wayfinding" : this.state.instruction }
                </Text>
                {btn}
            </View>
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
                    await this.adsumRnMap.cameraManager.centerOn(
                        this.adsumRnMap.objectManager.user,
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
