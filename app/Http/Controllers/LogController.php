<?php
namespace App\Http\Controllers;
use App\Models\Log;
use Illuminate\Http\Request;

class LogController extends Controller
{
    public function index(Request $request)
    {
        $query = Log::with('user');
        if ($request->user_id) $query->where('user_id', $request->user_id);
        if ($request->action) $query->where('action', 'like', "%{$request->action}%");
        return response()->json($query->latest()->paginate(20));
    }

    public function show(Log $log)
    {
        return response()->json($log->load('user'));
    }

    public function store(Request $request) {}
    public function update(Request $request, Log $log) {}
    public function destroy(Log $log) {}
}