let allPin = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId('e35d8dc7997909bb');

for (pin of allPin) {
    if (pin.pinNumber !== '1') continue;
    console.log(pin);
    const netPort = await eda.sch_PrimitiveComponent.createNetPort('IN', 'IN_1', pin.x - 10, pin.y, 180 - pin.rotation, false);
    const wire = await eda.sch_PrimitiveWire.create([pin.x - 10, pin.y, pin.x, pin.y]);
    console.log('netPort,wire', netPort, wire);

}
