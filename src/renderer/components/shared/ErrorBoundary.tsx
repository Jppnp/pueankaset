import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">เกิดข้อผิดพลาด</h1>
            <p className="text-gray-500 mb-6">กรุณาลองใหม่อีกครั้ง</p>
            <button
              onClick={() => {
                this.setState({ hasError: false })
                window.location.hash = '#/'
              }}
              className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
