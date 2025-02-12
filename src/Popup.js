// Popup.js
import React from "react";

function Popup({
  title,
  details,
  options = [],
  pollId,
  handleOptionClick,
  closePopup,
}) {
  return (
    <div style={popupStyles}>
      <div style={popupContentStyles}>
        <h2>{title}</h2>
        <p>{details}</p>
        <div style={optionsContainerStyles}>
          {options.length > 0 ? (
            options.map((option, index) => (
              <div key={index} style={optionItemStyles}>
                <span>
                  {option.text} (票数: {option.number})
                </span>
                <button
                  onClick={() => handleOptionClick(option, pollId, index)}
                >
                  选择
                </button>
              </div>
            ))
          ) : (
            <p>没有可选的项目</p>
          )}
        </div>
        <button onClick={closePopup}>关闭</button>
      </div>
    </div>
  );
}

const popupStyles = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const popupContentStyles = {
  backgroundColor: "white",
  padding: "20px",
  borderRadius: "8px",
  textAlign: "center",
  width: "300px",
};

const optionsContainerStyles = {
  marginTop: "20px",
  textAlign: "left",
};

const optionItemStyles = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 0",
  borderBottom: "1px solid #ccc",
};

export default Popup;
