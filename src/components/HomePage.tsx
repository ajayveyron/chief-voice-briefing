import { useAuth } from "@/hooks/useAuth";
import RealtimeVoiceChief from "@/components/RealtimeVoiceChief";

const HomePage = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex flex-col h-full w-full bg-black text-white items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Welcome to Chief</h1>
          <p className="text-gray-400">Please sign in to continue</p>
        </div>
      </div>
    );
  }

  return <RealtimeVoiceChief />;
};

export default HomePage;
