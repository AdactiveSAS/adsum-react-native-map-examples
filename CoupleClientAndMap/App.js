import React from 'react';
import { StyleSheet, WebView, View, Text } from 'react-native';
import { AdsumNativeMap, MOUSE_EVENTS } from '@adactive/adsum-react-native-map';
import { EntityManager } from '@adactive/adsum-client-api';

export default class App extends React.Component {
    constructor() {
        super();

        this.state = {
            ready: false,
            text: 'Tap to inspect'
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

        // Start the rendering
        await this.adsumRnMap.start();

        await this.entityManager.getRepository("Place").load();

        this.setState({ ready: true });

        // Register mouse listener events
        this.adsumRnMap.mouseManager.addEventListener(MOUSE_EVENTS.click, this.onMapClick.bind(this));
    }

    async onMapClick({intersects}) {
        // intersects is an array of intersected objects on the click location
        // intersects will be sort by deep in order

        if (intersects.length === 0) {
            this.setState({text: 'Empty'});
        }

        const place = await this.getPlaceFromAdsumObject(intersects[0].object);

        this.setState({text: JSON.stringify(place, null, 2)});
    }

    async getPlaceFromAdsumObject (adsumObject3D) {
        const placeId = await adsumObject3D.getPlaceId();

        return this.entityManager.getRepository("Place").get(placeId);
    };


    render() {
        // Render your map inside the Webview
        // Don't forget to add specific props to your WebView in order to let the map bind to it
        return (
            <View style={styles.container}>
                <WebView style={styles.webview} {...this.adsumRnMap.getWebViewProps()}>
                </WebView>
                <Text style={styles.text}>
                    {this.state.text}
                </Text>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column'
    },
    webview: {
        flex: 2,
    },
    text: {
        flex: 1
    }
});