// IMPORTANT: URL polyfill must be imported FIRST, before any other imports
// This fixes the "Cannot assign to property 'protocol'" error with Supabase in React Native
import 'react-native-url-polyfill/auto';

import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
