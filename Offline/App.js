import config from './config.json';
import React from 'react';
import { StyleSheet, WebView, View, Text, ScrollView, SectionList } from 'react-native';
import { AdsumNativeMap } from '@adactive/adsum-react-native-map';
import { EntityManager, LocalCacheManager } from '@adactive/adsum-client-api';

export default class App extends React.Component {
    constructor() {
        super();

        this.state = {
            ready: false,
        };
    }

    componentWillMount() {
        this.entityManager = new EntityManager(Object.assign({cacheManager: new LocalCacheManager()}, config));

        // Create the Map instance
        this.adsumRnMap = new AdsumNativeMap({});

        this.start();
    }

    async start() {
        await this.entityManager.loadFromCache(true);

        this.setState({ ready: true });

        // Init the Map
        await this.adsumRnMap.init({
            entityManager: this.entityManager,
            deviceId: 323,
        });

        // Start the rendering
        await this.adsumRnMap.start();
    }

    render() {
        if (!this.state.ready) {
            return (<Text>Loading in progress...</Text>);
        }

        // Render your map inside the Webview
        // Don't forget to add specific props to your WebView in order to let the map bind to it
        return (
            <View style={styles.container}>
                <WebView style={styles.webview} {...this.adsumRnMap.getWebViewProps()} />
                <ScrollView style={styles.inspect}>
                    <SectionList
                        renderItem={({item, index, section}) => <Text key={item.id}>{item.name} ({item.id})</Text>}
                        renderSectionHeader={({section: {title}}) => (
                            <Text style={{fontWeight: 'bold'}}>{title}</Text>
                        )}
                        sections={[
                            {title: 'Categories', data: this.entityManager.getRepository('Category').getAll()},
                            {title: 'POIs', data: this.entityManager.getRepository('Poi').getAll()},
                            {title: 'Tags', data: this.entityManager.getRepository('Tag').getAll()},
                            {title: 'Playlists', data: this.entityManager.getRepository('Playlist').getAll()},
                            {title: 'Medias', data: this.entityManager.getRepository('Media').getAll()},
                        ]}
                        keyExtractor={(item, index) => item.id}
                    />
                </ScrollView>
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
    inspect: {
        flex: 1
    }
});