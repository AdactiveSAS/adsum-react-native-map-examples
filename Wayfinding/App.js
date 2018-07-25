import React from 'react';
import {StyleSheet, WebView, PermissionsAndroid, Platform} from 'react-native';
import {AdsumNativeMap} from '@adactive/adsum-react-native-map';
import {EntityManager} from '@adactive/adsum-client-api';

export default class App extends React.Component {
    constructor() {
        super();

        this.state = {
            ready: false,
        };

        this.geolocationEnabled = false;
        this.geolocationWatchId = null;
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

        if (!this.geolocationEnabled) {
            if (Platform.OS === 'android' && Platform.Version >= 23) {
                try {
                    this.geolocationEnabled = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                        {
                            title: 'Enable Geolocation',
                            message: 'Required for the project'
                        }
                    );

                    if (this.geolocationEnabled) {
                        console.log('Geolocation permission granted');
                    } else {
                        console.warn('Geolocation permission denied');
                    }
                } catch (err) {
                    console.warn(err);
                }
            }
        }

        if (this.geolocationEnabled) {
            this.geolocationWatchId = navigator.geolocation.watchPosition(
                position => {
                    // console.log(position);
                },
                undefined,
                {
                    enableHighAccuracy: true,
                    distanceFilter: 1,
                    useSignificantChanges: true,
                }
            );
        }

        this.setState({ready: true});
    }

    componentWillUnmount() {
        if (this.geolocationWatchId !== null) {
            navigator.geolocation.clearWatch(this.geolocationWatchId);
            this.geolocationWatchId = null;
        }
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
