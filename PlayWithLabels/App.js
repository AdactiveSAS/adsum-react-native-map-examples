import React from 'react';
// Add new imports to display our new UI
import {StyleSheet, WebView, Platform, View, ToolbarAndroid, Button, Text, ActionSheetIOS} from 'react-native';
import {AdsumNativeMap, MOUSE_EVENTS} from '@adactive/adsum-react-native-map';
import {EntityManager} from '@adactive/adsum-client-api';
import EditComponent from "./components/EditComponent";

export default class App extends React.Component {
    /**
     * No Changes
     */
    constructor() {
        super();

        this.state = {
            ready: false,
            edit: false,
        };

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

        this.adsumRnMap.mouseManager.addEventListener(
            MOUSE_EVENTS.click,
            async (event) => {
                await this.edit(await this.getClickedLabel(event.intersects));
            }
        );

        // Start the rendering
        await this.adsumRnMap.start();

        this.setState({ready: true});
    }

    render() {
        // Refactor the render method in order to include the toolbar
        return (
            <View style={styles.container}>
                {this.renderToolbar()}
                {this.renderWebView()}
                {this.renderEditLabelView()}
            </View>
        );
    }

    renderEditLabelView() {
        if (this.state.edit) {
            return (<EditComponent style={styles.menu} labelObject={this.currentLabelEdit}/>);
        }
    }

    renderWebView() {
        // Code move from previous render method

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

        if ( this.state.ready ) {
            // If ready, then add the possible actions

            // Add the Site case (changeFloor(null))
            actions.push({title: 'Site'});
            floors.push(null);

            // For each floor add the action
            this.adsumRnMap.objectManager.floors.forEach((floor, id) => {
                actions.push({ title: `Set floor: ${id}`} );
                floors.push(floor);
            });
        }

        return (
            <ToolbarAndroid
                title="Play with Labels"
                actions={actions}
                onActionSelected={(index) => { this.changeFloor(floors[index]); }}
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
                <Text style={styles.titleText}>Play with Labels</Text>
                {btn}
            </View>
        );
    }

    toggleFloorsIOS() {
        const options = ['Site'];
        const floors = [null];

        this.adsumRnMap.objectManager.floors.forEach((floor, id) => {
            options.push(`Set floor: ${id}`);
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

    currentLabelEdit = null;

    async edit(labelObject) {
        if (this.currentLabelEdit === labelObject) {
            return;
        }

        if (this.currentLabelEdit !== null) {
            await this.currentLabelEdit.unselect();
            this.currentLabelEdit = null;
        }

        if (labelObject !== null) {
            await labelObject.select();
        }

        this.currentLabelEdit = labelObject;

        this.setState({edit: this.currentLabelEdit !== null});
    }

    async getClickedLabel(intersects) {
        if (intersects.length === 0) {
            return null;
        }

        // Let's grab the first intersect
        let { object } = intersects[0];

        if (object.isLabel) {
            return object;
        }

        // If building or space, then let's select the first label if any
        if (object.isBuilding || object.isSpace) {
            const labels = await object.getLabels();

            return labels.length === 0 ? null : labels[0];
        }

        return null;
    }
}

// Some style changes !
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
    menu: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: '#eeeeee',
    },
    titleText: {
        color: '#000000',
        alignItems: 'center',
        fontSize: 20,
        fontWeight: 'bold',
    },
});