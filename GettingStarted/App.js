import React from 'react';
import { StyleSheet, WebView } from 'react-native';
import { AdsumNativeMap } from '@adactive/adsum-react-native-map';
import { EntityManager } from '@adactive/adsum-client-api';

export default class App extends React.Component {
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
    }

    render() {
        // Render your map inside the Webview

        return (
            // Don't forget to add specific props to your WebView in order to let the map bind to it
            <WebView style={styles.webview} {...this.adsumRnMap.getWebViewProps()}>
            </WebView>
        );
    }
}

const styles = StyleSheet.create({
    webview: {
        flex: 1,
    },
});