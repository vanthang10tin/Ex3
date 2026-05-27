const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Cần cors để frontend gọi api không bị lỗi

const app = express();

// Khai báo middleware
app.use(cors());
app.use(express.json());
// Kết nối db lỗi 
//const MONGO_URI = "mongodb+srv://20224899:13102004@it4409-20224899.eiwb7o3.mongodb.net/?appName=it4409-20224899";
// Kết nối DB(link khi bỏ srv)
const MONGO_URI = "mongodb://20224899:13102004@ac-gz17jbz-shard-00-00.eiwb7o3.mongodb.net:27017,ac-gz17jbz-shard-00-01.eiwb7o3.mongodb.net:27017,ac-gz17jbz-shard-00-02.eiwb7o3.mongodb.net:27017/?ssl=true&replicaSet=atlas-zzkjek-shard-0&authSource=admin&appName=it4409-20224899";

mongoose.connect(MONGO_URI)
  .then(() => console.log("Kết nối MongoDB thành công!"))
  .catch((err) => {
    console.error("Lỗi phần kết nối DB:", err);
    process.exit(1);
  });

// --- TẠO SCHEMA THEO ĐÚNG YÊU CẦU ---
// Thêm unique: true cho email theo yêu cầu bổ sung
const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Tên không được để trống'],
    minlength: [2, 'Tên phải có ít nhất 2 ký tự']
  },
  age: { 
    type: Number, 
    required: [true, 'Tuổi không được để trống'],
    min: [0, 'Tuổi phải >= 0'],
    validate: {
      validator: Number.isInteger, //Tuổi phải là số nguyên
      message: 'Tuổi phải là số nguyên'
    }
  },
  email: { 
    type: String, 
    required: [true, 'Email không được để trống'],
    match: [/^\S+@\S+\.\S+$/, 'Email này nhập sai format'],
    unique: true //  Email không được trùng
  },
  address: { 
    type: String 
  }
});

const User = mongoose.model('User', userSchema);

// --- CRUD ---

// 1. GET: Lấy danh sách, phân trang, tìm kiếm
app.get('/api/users', async (req, res) => {
  try {
    // Mặc định là page 1, limit 5. Tránh user nhập số âm
    const page = Math.max(1, parseInt(req.query.page) || 1); 
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 5)); // Giới hạn limit max 50
    const search = req.query.search ? req.query.search.trim() : "";

    // Xử lý điều kiện tìm kiếm
    let filter = {};
    if (search) {
      filter = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { address: { $regex: search, $options: "i" } }
        ]
      };
    }

    const skip = (page - 1) * limit;

    // Dùng Promise để chạy 2 truy vấn song song
    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit),
      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      page,
      limit,
      total,
      totalPages,
      data: users
    });
  } catch (error) {
    res.status(500).json({ error: "Lỗi server: " + error.message });
  }
});

// 2. POST: Thêm mới người dùng
app.post('/api/users', async (req, res) => {
  try {
    let { name, age, email, address } = req.body;
    
    // Chuẩn hóa dữ liệu trước khi lưu
    name = name?.trim();
    email = email?.trim();
    address = address?.trim();

    const newUser = await User.create({ name, age, email, address });
    
    res.status(201).json({
      message: "Tạo người dùng thành công",
      data: newUser
    });
  } catch (error) {
    // Nếu trùng email thì MongoDB lỗi mã 11000
    if (error.code === 11000) {
        return res.status(400).json({ error: "Email này đã tồn tại trong hệ thống!" });
    }
    res.status(400).json({ error: "Lỗi dữ liệu đầu vào: " + error.message });
  }
});

// 3. PUT: Cập nhật thông tin
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    //Chỉ cập nhật những trường gửi lên, không gửi lên thì giữ nguyên
    const updateData = {};
    const allowedFields = ['name', 'age', 'email', 'address'];
    
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            // Trim chuỗi nếu nó là chữ
            updateData[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
        }
    });

    // Thêm runValidators để nó check lại schema một lần nữa lúc sửa
    const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    
    if (!updatedUser) {
      return res.status(404).json({ error: "Không tìm thấy người dùng này để sửa" });
    }
    res.status(200).json({ message: "Cập nhật thành công", data: updatedUser });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: "Email cập nhật bị trùng với người khác!" });
    res.status(400).json({ error: "Lỗi cập nhật: " + error.message });
  }
});

// 4. DELETE: Xóa người dùng
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    
    if (!deletedUser) {
      return res.status(404).json({ error: "Không tồn tại" });
    }
    res.status(200).json({ message: "Xóa người dùng thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi server khi xóa: " + error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server đã chạy lên tại http://localhost:${PORT}`);
});