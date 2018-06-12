import React from 'react';
import {StyleSheet, WebView, View, Button, Text} from 'react-native';
import RNFS from 'react-native-fs';
import {EntityManager, LocalCacheManager} from '@adactive/adsum-client-api';
import {AdsumNativeMap} from '@adactive/adsum-react-native-map';

const STATUS = {
    INITIAL: 'initial',
    DOWNLOADING: 'downloading',
    LOADING: 'loading',
    RUNNING: 'running'
};

export default class App extends React.Component {
    constructor() {
        super();

        this.state = {
            status: STATUS.INITIAL,
        };

        // Create the cacheManager
        this.cacheManager = new LocalCacheManager(`${RNFS.DocumentDirectoryPath}/my-cache-location`);

        // Create the entityManager
        this.entityManager = new EntityManager({
            site: 322,
            endpoint: "https://api.adsum.io",
            username: "323-device",
            key: "343169bf805f8abd5fa71a4f529594a654de6afbac70a2d867a8b458c526fb7d",
            cacheManager: this.cacheManager
        });

        // Create the Map
        this.adsumRnMap = new AdsumNativeMap({});
    }

    /**
     * Try to downloads the data
     */
    async synchronize() {
        this.setState({ status: STATUS.DOWNLOADING });

        try {
            await this.cacheManager.update(
                322,
                {
                    "endpoint": "https://api.adsum.io",
                    "username": "323-device",
                    "key": "343169bf805f8abd5fa71a4f529594a654de6afbac70a2d867a8b458c526fb7d"
                }
            );
        } catch(e) {
            console.warn(e);
        }

        this.setState({ status: STATUS.INITIAL });
    }

    /**
     * Starts
     */
    async start() {
        this.setState({ status: STATUS.LOADING });

        await this.adsumRnMap.init({ entityManager: this.entityManager, deviceId: 323 });

        await this.adsumRnMap.start();

        this.setState({ status: STATUS.RUNNING });
    }

    render() {
        switch (this.state.status) {
            case STATUS.INITIAL:
                return (
                    <View style={styles.btnContainer}>
                        <Button onPress={() => { this.synchronize() } } style={styles.btn} title="Synchronize"/>
                        <Button onPress={() => { this.start() } } style={styles.btn} title="Start"/>
                    </View>
                );
            case STATUS.DOWNLOADING:
                return (
                    <View style={styles.btnContainer}>
                        <Text style={styles.btn} >Downloading Data...</Text>
                    </View>
                );
            case STATUS.LOADING:
            case STATUS.RUNNING:
                return (
                    // Don't forget to add specific props to your WebView in order to let the map bind to it
                    <WebView style={styles.webview} {...this.adsumRnMap.getWebViewProps()}>
                    </WebView>
                );
        }
    }
}

const styles = StyleSheet.create({
    btnContainer: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-evenly',
    },
    btn: {
        color: '#000000',
        fontSize: 20,
        fontWeight: 'bold',
    },
    webview: {
        flex: 1,
    },
});