import React from "react";
import {Picker, Button, Text, View, ScrollView, StyleSheet, TextInput, Switch} from 'react-native';
import {Table, Row, TableWrapper, Cell} from 'react-native-table-component';
import {DISPLAY_MODES, DisplayLevelState} from '@adactive/adsum-react-native-map';

const styles = StyleSheet.create({
    container: {
        flex: 1, flexDirection: 'column', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)',
    },
    head: {height: 40, backgroundColor: '#f1f8ff'},
    text: {margin: 6, backgroundColor: '#ffffff'},
    row: {flexDirection: 'row', backgroundColor: '#FFF1C1', justifyContent: 'center'},
});

export default class LevelOfDetailsComponent extends React.Component {
    state = {
        /**
         * Does the current LevelOfDetails is active ?
         *
         * @type {boolean}
         */
        active: true,
        /**
         * The level states composing the level of details
         *
         * @type {LevelStateInterface[]}
         */
        levelStates: [],
        /**
         * The display mode input for the adding row
         *
         * @type {DISPLAY_MODES.VISIBLE|DISPLAY_MODES.NONE}
         */
        displayModeInput: DISPLAY_MODES.VISIBLE,
        /**
         * The start at input for the adding row
         *
         * @type {string}
         */
        inputStartAt: '0',
    };

    componentDidMount() {
        // Update levelOfDetails state
        this.updateLevelOfDetails();
    }

    UNSAFE_componentWillReceiveProps() {
        // Update levelOfDetails state
        this.updateLevelOfDetails();
    }

    async updateLevelOfDetails() {
        const levelStates = await this.props.labelObject.levelOfDetails.getLevelStates();
        const active = await this.props.labelObject.levelOfDetails.isActive();

        this.setState({levelStates, active});
    }

    async onRemove(startAt) {
        await this.props.labelObject.levelOfDetails.removeLevelState(startAt);

        this.updateLevelOfDetails();
    }

    async onAdd() {
        const startAt = parseFloat(this.state.inputStartAt);

        await this.props.labelObject.levelOfDetails.addLevelState(
            startAt,
            new DisplayLevelState(this.state.displayModeInput),
        );

        this.updateLevelOfDetails();
    }

    renderRemoveButton(startAt) {
        return (<Button title="REMOVE" onPress={() => this.onRemove(startAt)}/>);
    }

    renderAddRow() {
        const startAtInput = (
            <TextInput
                value={this.state.inputStartAt}
                onChangeText={(text) => {
                    this.setState({inputStartAt: text});
                }}
            />
        );

        const displayModeInput = (
            <Picker
                selectedValue={this.state.displayModeInput}
                onValueChange={(value) => {
                    this.setState({displayModeInput: value});
                }}
            >
                <Picker.Item
                    label={DISPLAY_MODES.VISIBLE}
                    key={DISPLAY_MODES.VISIBLE}
                    value={DISPLAY_MODES.VISIBLE}
                />
                <Picker.Item
                    label={DISPLAY_MODES.NONE}
                    key={DISPLAY_MODES.NONE}
                    value={DISPLAY_MODES.NONE}
                />
            </Picker>
        );

        const addBtn = (<Button title="ADD" onPress={() => this.onAdd()}/>);

        return (
            <TableWrapper key={-1} style={styles.row}>
                <Cell key="startAt" data={startAtInput} textStyle={styles.text}/>
                <Cell key="displayMode" data={displayModeInput} textStyle={styles.text}/>
                <Cell key="add" data={addBtn}/>
            </TableWrapper>
        );
    }

    async onChangeActive(active) {
        this.setState({active});

        await this.props.labelObject.levelOfDetails.setActive(active);
    }

    renderLevelStateRow(startAt, levelState, key) {
        const displayMode = levelState instanceof DisplayLevelState ? levelState.displayMode : 'Unknown Level State' ;

        return (
            <TableWrapper key={key} style={styles.row}>
                <Cell key="startAt" data={startAt} textStyle={styles.text}/>
                <Cell key="displayMode" data={displayMode} textStyle={styles.text}/>
                <Cell key="remove" data={this.renderRemoveButton(startAt)}/>
            </TableWrapper>
        );
    }

    render() {
        return (
            <ScrollView>
                <View style={styles.inputRow}>
                    <Text style={styles.label}>Level of Details is active:</Text>
                    <Switch style={styles.input} onValueChange={(value) => {
                        this.onChangeActive(value)
                    }} value={this.state.active}/>
                </View>
                <Text>Levels States:</Text>
                <Table borderStyle={{borderWidth: 2, borderColor: '#c8e1ff'}}>
                    <Row data={['StartAt', 'DisplayMode', 'Action']} style={styles.head} textStyle={styles.text}/>
                    {
                        this.state.levelStates.map(({startAt, levelState}, index) => this.renderLevelStateRow(startAt, levelState, index))
                    }
                    {this.renderAddRow()}
                </Table>
            </ScrollView>
        );
    }
}