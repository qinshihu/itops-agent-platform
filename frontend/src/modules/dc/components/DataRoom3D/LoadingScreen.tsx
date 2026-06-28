export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-full bg-[#0d1825]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-cyan-400 text-sm tracking-widest animate-pulse">
          构建数字孪生场景...
        </p>
      </div>
    </div>
  );
}
