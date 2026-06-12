import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import socket from "../services/socket";

function InterviewRoom() {

  const { roomCode } = useParams();

  const currentUser =
  JSON.parse(
    localStorage.getItem("user")
  );

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  // Join socket room
  useEffect(() => {

    socket.emit(
      "join-room",
      roomCode
    );

    console.log(
      `Joined room ${roomCode}`
    );

  }, [roomCode]);

  // Listen for incoming messages
  useEffect(() => {

    socket.on(
      "receive-message",
      (data) => {

        console.log(
          "Message received:",
          data
        );

        setMessages(
          (prev) => [...prev, data]
        );

      }
    );

    return () => {

      socket.off(
        "receive-message"
      );

    };

  }, []);

  const sendMessage = () => {

    if (!message.trim()) return;

   const currentUser =
  JSON.parse(
    localStorage.getItem("user")
  );

const messageData = {
  roomCode,
  sender: currentUser.name,
  message
};

    socket.emit(
      "send-message",
      messageData
    );

    setMessage("");

  };

  return (

    <div
      style={{
        padding: "20px",
        maxWidth: "800px",
        margin: "auto"
      }}
    >

      <h1>Interview Room</h1>

      <h2>
        Room Code: {roomCode}
      </h2>

      <hr />

      {/* Chat Box */}

      <div
        style={{
          border: "1px solid #ccc",
          height: "300px",
          overflowY: "scroll",
          padding: "10px",
          marginBottom: "20px"
        }}
      >

        {messages.length === 0 ? (
          <p>No messages yet...</p>
        ) : (

          messages.map(
            (msg, index) => (

              <div
                key={index}
                style={{
                  marginBottom: "10px"
                }}
              >

                <strong>
                  {msg.sender}
                </strong>

                : {msg.message}

              </div>

            )
          )

        )}

      </div>

      {/* Input */}

      <input
        type="text"
        value={message}
        placeholder="Type message"
        onChange={(e) =>
          setMessage(e.target.value)
        }
        style={{
          width: "70%",
          padding: "10px"
        }}
      />

      <button
        onClick={sendMessage}
        style={{
          padding: "10px",
          marginLeft: "10px"
        }}
      >
        Send
      </button>

    </div>

  );

}

export default InterviewRoom;