import React from 'react';
import {View, StyleSheet, Text, TouchableOpacity, Switch, TextInput, ScrollView, Picker} from 'react-native';
import {LABEL_ORIENTATION_MODES} from '@adactive/adsum-react-native-map';
import tinycolor from 'tinycolor2';
import {SlidersColorPicker} from 'react-native-color';

const styles = StyleSheet.create({
    inputRow: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        flex: 1,
        fontSize: 15,
    },
    input: {
        flex: 1,
        minHeight: 40,
        alignItems: 'center',
        justifyContent: 'center'
    },
});

const INPUT_TYPES = {
    bool: 'bool',
    number: 'number',
    color: 'color',
    select: 'select',
    text: 'text',
};

export default class EditComponent extends React.Component {
    constructor(props) {
        super(props);

        this.style = props.style;

        this.initState();
    }

    state = {
        form: [],
        colorPicker: null,
    };

    style = null;

    async initState() {
        const offset = await this.props.labelObject.getOffset();
        const scale = await this.props.labelObject.getScale();

        const orientationMode = await this.props.labelObject.getOrientationMode();
        const isAutoScale = await this.props.labelObject.isAutoScale();

        const form = [
            {
                name: 'isAutoScale',
                value: isAutoScale,
                type: INPUT_TYPES.bool,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('isAutoScale', value);
                    await this.props.labelObject.setAutoScale(value);

                    if (value) {
                        this.disableInput('scaleX');
                        this.disableInput('scaleY');
                        this.disableInput('scaleZ');
                    } else {
                        const newScale = await this.props.labelObject.getScale();
                        this.refreshInput('scaleX', newScale.x);
                        this.refreshInput('scaleY', newScale.y);
                        this.refreshInput('scaleZ', newScale.z);
                    }
                }
            },
            {
                name: 'isPermanentDisplay',
                value: await this.props.labelObject.isPermanentDisplay(),
                type: INPUT_TYPES.bool,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('isPermanentDisplay', value);
                    await this.props.labelObject.setPermanentDisplay(value);
                }
            },
            {
                name: 'orientationMode',
                value: orientationMode,
                type: INPUT_TYPES.select,
                disabled: false,
                choices: [LABEL_ORIENTATION_MODES.BILLBOARD, LABEL_ORIENTATION_MODES.STATIC],
                onChange: async (value) => {
                    this.refreshInput('orientationMode', value);
                    if (value === LABEL_ORIENTATION_MODES.STATIC) {
                        this.enableInput('rotation');
                    } else {
                        this.disableInput('rotation');
                    }
                    await this.props.labelObject.setOrientationMode(value);
                }
            },
            {
                name: 'offsetX',
                value: offset.x,
                type: INPUT_TYPES.number,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('offsetX', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.moveTo(v, offset.y, offset.z);
                    }
                }
            },
            {
                name: 'offsetY',
                value: offset.y,
                type: INPUT_TYPES.number,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('offsetY', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.moveTo(offset.x, v, offset.z);
                    }
                }
            },
            {
                name: 'offsetZ',
                value: offset.z,
                type: INPUT_TYPES.number,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('offsetZ', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.moveTo(offset.x, offset.y, v);
                    }
                }
            },
            {
                name: 'opacity',
                value: await this.props.labelObject.getOpacity(),
                type: INPUT_TYPES.number,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('opacity', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.setOpacity(v);
                    }
                }
            },
            {
                name: 'scaleX',
                value: scale.x,
                type: INPUT_TYPES.number,
                disabled: isAutoScale,
                onChange: async (value) => {
                    this.refreshInput('scaleX', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.setScale(v, scale.y, scale.z);
                    }
                }
            },
            {
                name: 'scaleY',
                value: scale.y,
                type: INPUT_TYPES.number,
                disabled: isAutoScale,
                onChange: async (value) => {
                    this.refreshInput('scaleY', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.setScale(scale.x, v, scale.z);
                    }
                }
            },
            {
                name: 'scaleZ',
                value: scale.z,
                type: INPUT_TYPES.number,
                disabled: isAutoScale,
                onChange: async (value) => {
                    this.refreshInput('scaleZ', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.setScale(scale.x, scale.y, v);
                    }
                }
            },
            {
                name: 'rotation',
                value: await this.props.labelObject.getRotation(),
                type: INPUT_TYPES.number,
                disabled: orientationMode !== LABEL_ORIENTATION_MODES.STATIC,
                onChange: async (value) => {
                    this.refreshInput('rotation', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.setRotation(v);
                    }
                }
            },
        ];

        if (this.props.labelObject.isLabelImage) {
            form.push({
                name: 'height',
                value: await this.props.labelObject.getHeight(),
                type: INPUT_TYPES.number,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('height', value);
                    const v = parseInt(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.setHeight(v);
                    }
                }
            });
            form.push({
                name: 'width',
                value: await this.props.labelObject.getWidth(),
                type: INPUT_TYPES.number,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('width', value);
                    const v = parseInt(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.setWidth(v);
                    }
                }
            });
        }

        if (this.props.labelObject.isLabelText) {
            form.push({
                name: 'text',
                value: await this.props.labelObject.getText(),
                type: INPUT_TYPES.text,
                multiline: true,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('text', value);
                    await this.props.labelObject.setText(value);
                }
            });

            const style = await this.props.labelObject.getStyle();

            form.push({
                name: 'size',
                value: style.size,
                type: INPUT_TYPES.number,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('size', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.setStyle({size: v});
                    }
                }
            });
            form.push({
                name: 'color',
                value: style.color,
                type: INPUT_TYPES.color,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('color', value);
                    await this.props.labelObject.setStyle({color: value});
                }
            });
            form.push({
                name: 'lineHeight',
                value: style.lineHeight,
                type: INPUT_TYPES.number,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('lineHeight', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.setStyle({lineHeight: v});
                    }
                }
            });

            form.push({
                name: 'hasBackground',
                value: style.backgroundColor !== null,
                type: INPUT_TYPES.bool,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('hasBackground', value);
                    if (value) {
                        this.refreshInput('backgroundColor', '#cccccc');
                        this.enableInput('backgroundOpacity');
                        this.enableInput('backgroundRadius');
                        await this.props.labelObject.setStyle({backgroundColor: "#cccccc"});
                    } else {
                        this.disableInput('backgroundColor');
                        this.disableInput('backgroundOpacity');
                        this.disableInput('backgroundRadius');
                        await this.props.labelObject.setStyle({backgroundColor: null});
                    }
                }
            });

            form.push({
                name: 'backgroundColor',
                value: style.backgroundColor,
                type: INPUT_TYPES.color,
                disabled: style.backgroundColor === null,
                onChange: async (value) => {
                    this.refreshInput('backgroundColor', value);
                    await this.props.labelObject.setStyle({backgroundColor: value});
                }
            });

            form.push({
                name: 'backgroundOpacity',
                value: style.backgroundOpacity,
                type: INPUT_TYPES.number,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('backgroundOpacity', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.setStyle({backgroundOpacity: v});
                    }
                }
            });
            form.push({
                name: 'backgroundRadius',
                value: style.backgroundRadius,
                type: INPUT_TYPES.number,
                disabled: false,
                onChange: async (value) => {
                    this.refreshInput('backgroundRadius', value);
                    const v = parseFloat(value);
                    if (!isNaN(v)) {
                        await this.props.labelObject.setStyle({backgroundRadius: v});
                    }
                }
            });
        }

        this.setState({form});
    }

    UNSAFE_componentWillReceiveProps() {
        this.initState();
    }

    refreshInput(name, value) {
        const form = [...this.state.form];

        for (let i = 0; i < form.length; i++) {
            if (form[i].name === name) {
                form[i].value = value;
                form[i].disabled = false;
            }
        }

        this.setState({form});
    }

    enableInput(name) {
        const form = [...this.state.form];

        for (let i = 0; i < form.length; i++) {
            if (form[i].name === name) {
                form[i].disabled = false;
            }
        }

        this.setState({form});
    }

    disableInput(name) {
        const form = [...this.state.form];

        for (let i = 0; i < form.length; i++) {
            if (form[i].name === name) {
                form[i].disabled = true;
            }
        }

        this.setState({form});
    }

    renderForm() {
        return (
            <ScrollView>
                {this.state.form.map(data => this.renderInput(data))}
            </ScrollView>
        );
    }

    renderInput(data) {
        if (data.disabled) {
            return;
        }

        switch (data.type) {
            case INPUT_TYPES.bool:
                return this.renderBoolInput(data);
            case INPUT_TYPES.text:
                return this.renderTextInput(data);
            case INPUT_TYPES.number:
                return this.renderNumberInput(data);
            case INPUT_TYPES.select:
                return this.renderSelectInput(data);
            case INPUT_TYPES.color:
                return this.renderColorInput(data);
        }
    }

    renderBoolInput({name, value, onChange}) {
        return (
            <View key={name} style={styles.inputRow}>
                <Text style={styles.label}>{name}:</Text>
                <Switch style={styles.input} onValueChange={onChange} value={value}/>
            </View>
        );
    }

    renderTextInput({name, onChange, value, multiline}) {
        const numberOfLines = value.split('\n').length;
        return (
            <View key={name} style={styles.inputRow}>
                <Text style={styles.label}>{name}:</Text>
                <TextInput style={styles.input} value={String(value)} onChangeText={onChange} multiline={multiline} numberOfLines={numberOfLines}/>
            </View>
        );
    }

    renderNumberInput({name, onChange, value}) {
        return (
            <View key={name} style={styles.inputRow}>
                <Text style={styles.label}>{name}:</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={String(value)} onChangeText={onChange}/>
            </View>
        );
    }

    renderSelectInput({name, value, onChange, choices}) {
        return (
            <View key={name} style={styles.inputRow}>
                <Text style={styles.label}>{name}:</Text>
                <Picker style={styles.input} selectedValue={value} onValueChange={onChange}>
                    {choices.map((choice) => (<Picker.Item label={choice} key={choice} value={choice}/>))}
                </Picker>
            </View>
        );
    }

    renderColorInput({value, name, onChange}) {
        const overlayTextColor = tinycolor(value).isDark() ? '#FAFAFA' : '#222';

        return (
            <View key={name} style={styles.inputRow}>
                <Text style={styles.label}>{name}:</Text>
                <TouchableOpacity
                    onPress={() => this.setState({colorPicker: {onChange, value}})}
                    style={[styles.input, {backgroundColor: tinycolor(value).toHslString()}]}
                >
                    <Text style={[styles.input, {color: overlayTextColor}]}>
                        {tinycolor(value).toHexString()}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    renderColorPicker() {
        if (this.state.colorPicker !== null) {
            const {value, onChange} = this.state.colorPicker;

            return (<SlidersColorPicker
                visible={true}
                color={value}
                returnMode="hex"
                onCancel={() => this.setState({colorPicker: null})}
                onOk={(color) => {
                    this.setState({colorPicker: null});
                    onChange(color);
                }}
                swatches={['#247ba0', '#70c1b3', '#b2dbbf', '#f3ffbd', '#ff1654']}
                swatchesLabel="PRESET"
                okLabel="Done"
                cancelLabel="Cancel"
            />);
        }
    }

    render() {
        return (
            <View style={this.style}>
                {this.renderColorPicker()}
                {this.renderForm()}
            </View>
        );
    }
}