const px = value => Number.parseFloat(value) || 0;
export function extractStyles(node, computed) {
  const styles = {
    fontFamily: computed.fontFamily, fontSize:px(computed.fontSize), fontWeight:computed.fontWeight,
    lineHeight:computed.lineHeight === "normal" ? "normal" : px(computed.lineHeight), letterSpacing:computed.letterSpacing === "normal" ? 0 : px(computed.letterSpacing),
    color:computed.color, background:computed.backgroundImage !== "none" ? computed.backgroundImage : computed.backgroundColor,
    border:computed.border, borderRadius:px(computed.borderRadius), boxShadow:computed.boxShadow,
    textAlign:computed.textAlign, objectFit:computed.objectFit, objectPosition:computed.objectPosition,
  };
  return Object.fromEntries(Object.entries(styles).filter(([,value])=>value!=="" && value!==undefined && value!=="none" && value!==0));
}

export function visualBackground(computed) {
  return computed.backgroundImage !== "none" ? computed.backgroundImage : computed.backgroundColor;
}
