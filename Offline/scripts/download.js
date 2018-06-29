const {LocalCacheManager} = require('@adactive/adsum-client-api');

const path = require('path');

const cacheManager = new LocalCacheManager(
    path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'adsum-data')
);

cacheManager.update(
    322,
    {
        "endpoint": "https://api.adsum.io",
        "username": "323-device",
        "key": "343169bf805f8abd5fa71a4f529594a654de6afbac70a2d867a8b458c526fb7d"
    }
);