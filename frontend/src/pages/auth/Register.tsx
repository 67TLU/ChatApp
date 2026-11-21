import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/services/api/client';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  username: z.string().min(3, 'Tối thiểu 3 ký tự').max(32)
    .regex(/^[a-zA-Z0-9_]+$/, 'Chỉ chữ, số và _'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
  displayName: z.string().max(64).optional(),
});

type FormData = z.infer<typeof schema>;

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await apiClient.post('/auth/register', data);
      toast.success('Đăng ký thành công! Hãy đăng nhập.');
      navigate('/login');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Đăng ký</CardTitle>
          <CardDescription>Tạo tài khoản mới để bắt đầu</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input type="email" placeholder="Email" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <Input placeholder="Username" {...register('username')} />
              {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
            </div>
            <Input placeholder="Tên hiển thị (tuỳ chọn)" {...register('displayName')} />
            <div>
              <Input type="password" placeholder="Mật khẩu" {...register('password')} />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Đang đăng ký...' : 'Đăng ký'}
            </Button>
            <div className="text-center text-sm">
              <Link to="/login" className="text-blue-600 hover:underline">
                Đã có tài khoản? Đăng nhập
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}