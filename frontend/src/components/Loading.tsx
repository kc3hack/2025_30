interface LoadingProps {
  message?: string;
}

export const Loading = ({ message = "Loading..." }: LoadingProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        <p className="text-lg font-medium text-gray-700">{message}</p>
      </div>
    </div>
  );
};