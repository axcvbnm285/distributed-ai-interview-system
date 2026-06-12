import api from "../services/api";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

function Dashboard() {

  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState("");

  const createRoom = async () => {

    try {

      const token =
        localStorage.getItem("token");

      const response =
        await api.post(
          "/rooms",
          {},
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );

      navigate(
        `/room/${response.data.roomCode}`
      );

    } catch (error) {

      console.error(error);

    }

  };

  const joinRoom = async () => {

    try {

      const token =
        localStorage.getItem("token");

      await api.post(
        `/rooms/${roomCode}/join`,
        {},
        {
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );

      navigate(
        `/room/${roomCode}`
      );

    } catch (error) {

      console.error(error);

      alert("Unable to join room");

    }

  };

  return (

    <div>

      <h1>Dashboard</h1>

      <button onClick={createRoom}>
        Create Room
      </button>

      <hr />

      <input
        placeholder="Enter Room Code"
        value={roomCode}
        onChange={(e) =>
          setRoomCode(e.target.value)
        }
      />

      <button onClick={joinRoom}>
        Join Room
      </button>

    </div>

  );

}

export default Dashboard;